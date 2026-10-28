// Sincronización en los dos sentidos entre Salidas y un calendario de Google.
//
//  1. App → Google: altas (sin googleEventId), cambios (updatedAt > googleSyncedAt; con If-Match
//     del etag para no pisar cambios hechos allá) y bajas (deletedAt).
//  2. Google → App: Events.list con syncToken (incremental); si Google lo invalida (410), sync
//     completa. Lo que ya vimos (mismo etag) se ignora.
//  Conflictos (se cambió de los dos lados): gana el cambio más reciente y queda en google_sync_log.
//
// `client` se inyecta (ver calendarClient.js); en los tests es un calendario en memoria.
import { outingToEvent, eventToOuting } from "./eventMapping.js";

const nowIso = () => new Date().toISOString();

export async function getAccount(db) {
  return await db.prepare("SELECT * FROM google_account WHERE id = 1").get() ?? null;
}

export async function saveAccount(db, fields) {
  const current = await getAccount(db) ?? { status: "disconnected" };
  const merged = { ...current, ...fields, updatedAt: nowIso() };
  await db.prepare(
    `INSERT INTO google_account (id, refreshTokenEnc, email, calendarId, calendarName, syncToken, lastSyncAt, lastError, status, updatedAt)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET refreshTokenEnc=excluded.refreshTokenEnc, email=excluded.email, calendarId=excluded.calendarId,
       calendarName=excluded.calendarName, syncToken=excluded.syncToken, lastSyncAt=excluded.lastSyncAt, lastError=excluded.lastError,
       status=excluded.status, updatedAt=excluded.updatedAt`
  ).run(
    merged.refreshTokenEnc ?? null,
    merged.email ?? null,
    merged.calendarId ?? null,
    merged.calendarName ?? null,
    merged.syncToken ?? null,
    merged.lastSyncAt ?? null,
    merged.lastError ?? null,
    merged.status,
    merged.updatedAt
  );
  return await getAccount(db);
}

export async function logSync(db, kind, message, outingId = null) {
  await db.prepare("INSERT INTO google_sync_log (at, kind, message, outingId) VALUES (?, ?, ?, ?)").run(nowIso(), kind, message, outingId);
  // Alcanza con lo último: se recorta a 200 entradas.
  await db.prepare("DELETE FROM google_sync_log WHERE id NOT IN (SELECT id FROM google_sync_log ORDER BY id DESC LIMIT 200)").run();
}

const isDirty = (o) => !o.googleSyncedAt || o.updatedAt > o.googleSyncedAt;
const newer = (a, b) => new Date(a).getTime() > new Date(b).getTime();

export function createCalendarSync(db, client) {
  const byGoogleId = db.prepare("SELECT * FROM outings WHERE googleEventId = ?");
  const byId = db.prepare("SELECT * FROM outings WHERE id = ?");

  /** Guarda que esta versión local ya está en Google (sin tocar updatedAt). */
  async function markSynced(outingId, ev, localUpdatedAt) {
    await db.prepare("UPDATE outings SET googleEventId = ?, googleEtag = ?, googleUpdated = ?, googleSyncedAt = ? WHERE id = ?").run(ev.id, ev.etag, ev.updated, localUpdatedAt, outingId);
  }

  /** Pisa la salida local con el evento de Google. */
  async function applyRemote(outingId, ev) {
    const f = eventToOuting(ev);
    const ts = nowIso();
    await db.prepare(
      `UPDATE outings SET title=?, category=?, date=?, startTime=?, endTime=?, allDay=?, place=?, withWhom=?, notes=?, status=?,
       googleEventId=?, googleEtag=?, googleUpdated=?, googleSyncedAt=?, deletedAt=NULL, updatedAt=? WHERE id=?`
    ).run(f.title, f.category, f.date, f.startTime, f.endTime, f.allDay, f.place, f.withWhom, f.notes, f.status, ev.id, ev.etag, ev.updated, ts, ts, outingId);
  }

  async function insertFromRemote(ev) {
    const f = eventToOuting(ev);
    const ts = nowIso();
    await db.prepare(
      `INSERT INTO outings (title, category, date, startTime, endTime, allDay, place, withWhom, notes, status, source,
         googleEventId, googleEtag, googleUpdated, googleSyncedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google', ?, ?, ?, ?, ?, ?)`
    ).run(f.title, f.category, f.date, f.startTime, f.endTime, f.allDay, f.place, f.withWhom, f.notes, f.status, ev.id, ev.etag, ev.updated, ts, ts, ts);
  }

  async function push(calendarId, stats) {
    for (const o of await db.prepare("SELECT * FROM outings ORDER BY id").all()) {
      if (o.deletedAt) {
        if (o.googleEventId) {
          try {
            await client.deleteEvent(calendarId, o.googleEventId);
          } catch (err) {
            if (err.status !== 404 && err.status !== 410) throw err;
          }
        }
        await db.prepare("DELETE FROM outings WHERE id = ?").run(o.id);
        stats.pushedDeleted += 1;
        continue;
      }
      if (!o.googleEventId) {
        await markSynced(o.id, await client.insertEvent(calendarId, outingToEvent(o)), o.updatedAt);
        stats.pushedNew += 1;
        continue;
      }
      if (!isDirty(o)) continue;
      try {
        await markSynced(o.id, await client.patchEvent(calendarId, o.googleEventId, outingToEvent(o), o.googleEtag), o.updatedAt);
        stats.pushedUpdated += 1;
      } catch (err) {
        if (err.status === 412) {
          // Cambió también en Google: gana el más reciente.
          const remote = await client.getEvent(calendarId, o.googleEventId);
          stats.conflicts += 1;
          if (newer(remote.updated, o.updatedAt)) {
            await applyRemote(o.id, remote);
            await logSync(db, "conflict", `“${o.title}” cambió en los dos lados: quedó la versión de Google (más reciente).`, o.id);
          } else {
            await markSynced(o.id, await client.patchEvent(calendarId, o.googleEventId, outingToEvent(o), null), o.updatedAt);
            await logSync(db, "conflict", `“${o.title}” cambió en los dos lados: quedó la versión de la app (más reciente).`, o.id);
          }
        } else if (err.status === 404 || err.status === 410) {
          // La borraron en Google pero acá se editó después: se vuelve a crear allá.
          await markSynced(o.id, await client.insertEvent(calendarId, outingToEvent(o)), o.updatedAt);
          await logSync(db, "conflict", `“${o.title}” se borró en Google pero la editaste después: se volvió a crear.`, o.id);
          stats.conflicts += 1;
        } else throw err;
      }
    }
  }

  async function applyEvent(ev, stats) {
    const appId = Number(ev.extendedProperties?.private?.outingId) || null;
    let local = await byGoogleId.get(ev.id) ?? null;
    // Evento creado por la app cuyo vínculo se perdió: se reconoce por el id privado.
    if (!local && appId) {
      const candidate = await byId.get(appId);
      if (candidate && !candidate.googleEventId) local = candidate;
    }

    if (ev.status === "cancelled") {
      if (!local) return;
      if (isDirty(local) && ev.updated && newer(local.updatedAt, ev.updated)) {
        // Se borró allá, pero acá se editó después: queda acá y se vuelve a subir.
        await db.prepare("UPDATE outings SET googleEventId = NULL, googleEtag = NULL, googleSyncedAt = NULL WHERE id = ?").run(local.id);
        await logSync(db, "conflict", `“${local.title}” se borró en Google pero la editaste después: se mantiene.`, local.id);
        stats.conflicts += 1;
        return;
      }
      await db.prepare("DELETE FROM outings WHERE id = ?").run(local.id);
      stats.pulledDeleted += 1;
      return;
    }

    if (!local) {
      await insertFromRemote(ev);
      stats.pulledNew += 1;
      return;
    }
    if (local.googleEtag === ev.etag) return; // ya lo teníamos (incluye el "eco" de lo que subimos)
    if (isDirty(local) && newer(local.updatedAt, ev.updated)) {
      await logSync(db, "conflict", `“${local.title}” cambió en los dos lados: quedó la versión de la app (más reciente).`, local.id);
      stats.conflicts += 1;
      return; // se sube en la próxima pasada
    }
    await applyRemote(local.id, ev);
    stats.pulledUpdated += 1;
  }

  async function pull(calendarId, stats, { full = false } = {}) {
    let syncToken = full ? null : (await getAccount(db))?.syncToken ?? null;
    let pageToken = null;
    let nextSyncToken = null;
    do {
      let res;
      try {
        res = await client.listEvents(calendarId, { syncToken, pageToken });
      } catch (err) {
        if (err.status === 410 && syncToken) {
          // El token venció: sync completa desde cero.
          await saveAccount(db, { syncToken: null });
          await logSync(db, "info", "Google pidió una sincronización completa (token vencido).");
          stats.fullResync = true;
          return await pull(calendarId, stats, { full: true });
        }
        throw err;
      }
      for (const ev of res.items || []) await applyEvent(ev, stats);
      pageToken = res.nextPageToken || null;
      nextSyncToken = res.nextSyncToken || nextSyncToken;
    } while (pageToken);
    if (nextSyncToken) await saveAccount(db, { syncToken: nextSyncToken });
  }

  /** Una pasada completa: subir, bajar y anotar el resultado en la cuenta. */
  async function syncNow() {
    const account = await getAccount(db);
    if (!account?.calendarId) throw Object.assign(new Error("no_calendar"), { status: 409 });
    const stats = { pushedNew: 0, pushedUpdated: 0, pushedDeleted: 0, pulledNew: 0, pulledUpdated: 0, pulledDeleted: 0, conflicts: 0, fullResync: false };
    try {
      await push(account.calendarId, stats);
      await pull(account.calendarId, stats);
      await saveAccount(db, { lastSyncAt: nowIso(), lastError: null, status: "connected" });
      return stats;
    } catch (err) {
      const revoked = err.code === "invalid_grant" || err.status === 401;
      await saveAccount(db, { lastError: err.message, status: revoked ? "revoked" : "error" });
      await logSync(db, "error", err.message);
      throw err;
    }
  }

  return { syncNow, push, pull };
}
