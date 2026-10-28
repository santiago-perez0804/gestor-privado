import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { createCalendarSync, saveAccount, getAccount } from "../src/services/google/sync.js";
import { outingToEvent, eventToOuting, toLocalParts } from "../src/services/google/eventMapping.js";

/** Google Calendar falso: etags, syncToken por versión, eventos cancelados, If-Match y 410. */
function fakeCalendar() {
  let version = 0;
  let clock = Date.parse("2026-10-01T12:00:00Z");
  let seq = 0;
  const events = new Map();
  const err = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
  const touch = (ev, at) => {
    version += 1;
    clock = Math.max(clock + 1000, at ? Date.parse(at) : 0);
    ev.etag = `"e${version}"`;
    ev.updated = new Date(clock).toISOString();
    ev._v = version;
    return ev;
  };
  const pub = (ev) => {
    const { _v, ...rest } = ev;
    return structuredClone(rest);
  };
  return {
    events,
    expireTokens: false,
    calls: [],
    async listEvents(cal, { syncToken, pageToken }) {
      this.calls.push(["list", syncToken ?? null, pageToken ?? null]);
      if (syncToken && this.expireTokens) {
        this.expireTokens = false;
        throw err(410);
      }
      const since = syncToken ? Number(syncToken.slice(1)) : 0;
      const all = [...events.values()].filter((e) => e._v > since && (since > 0 || e.status !== "cancelled")).sort((a, b) => a._v - b._v);
      const start = Number(pageToken || 0);
      const page = all.slice(start, start + 2); // páginas chicas para probar la paginación
      const more = start + 2 < all.length;
      return { items: page.map(pub), nextPageToken: more ? String(start + 2) : undefined, nextSyncToken: more ? undefined : `t${version}` };
    },
    async getEvent(cal, id) {
      if (!events.has(id)) throw err(404);
      return pub(events.get(id));
    },
    async insertEvent(cal, body) {
      this.calls.push(["insert", body.summary]);
      const ev = touch({ ...structuredClone(body), id: `g${++seq}`, status: body.status || "confirmed" });
      events.set(ev.id, ev);
      return pub(ev);
    },
    async patchEvent(cal, id, body, etag) {
      this.calls.push(["patch", body.summary, etag]);
      const ev = events.get(id);
      if (!ev || ev.status === "cancelled") throw err(404);
      if (etag && etag !== ev.etag) throw err(412);
      Object.assign(ev, structuredClone(body));
      return pub(touch(ev));
    },
    async deleteEvent(cal, id) {
      this.calls.push(["delete", id]);
      const ev = events.get(id);
      if (!ev) throw err(404);
      ev.status = "cancelled";
      touch(ev);
      return null;
    },
    // Cambios hechos "en Google" (desde el celular, por ejemplo).
    remoteCreate(body, at) {
      const ev = touch({ ...body, id: `g${++seq}`, status: body.status || "confirmed" }, at);
      events.set(ev.id, ev);
      return ev;
    },
    remoteEdit(id, patch, at) {
      Object.assign(events.get(id), patch);
      return touch(events.get(id), at);
    },
    remoteDelete(id) {
      events.get(id).status = "cancelled";
      touch(events.get(id));
    },
  };
}

async function setup() {
  const db = await testDb();
  await saveAccount(db, { calendarId: "salidas@group.calendar.google.com", refreshTokenEnc: "x", status: "connected" });
  const cal = fakeCalendar();
  const sync = createCalendarSync(db, cal);
  const addLocal = async (fields, updatedAt = "2026-10-02T10:00:00.000Z") =>
    (await db
      .prepare("INSERT INTO outings (title, date, startTime, allDay, place, withWhom, category, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(fields.title, fields.date, fields.startTime ?? null, fields.startTime ? 0 : 1, fields.place ?? null, fields.withWhom ?? null, fields.category ?? null, fields.status ?? "confirmed", updatedAt, updatedAt)).lastInsertRowid;
  const get = async (id) => await db.prepare("SELECT * FROM outings WHERE id = ?").get(id);
  const editLocal = async (id, fields, updatedAt) => {
    const sets = Object.keys(fields).map((k) => `${k} = ?`);
    await db.prepare(`UPDATE outings SET ${sets.join(", ")}, updatedAt = ? WHERE id = ?`).run(...Object.values(fields), updatedAt, id);
  };
  return { db, cal, sync, addLocal, get, editLocal };
}

test("mapeo: día completo, con horario (2 h por defecto) y zona horaria de Buenos Aires", () => {
  const allDay = outingToEvent({ id: 1, title: "Oktoberfest", date: "2026-10-10", allDay: 1, status: "confirmed", category: "fiesta" });
  assert.deepEqual(allDay.start, { date: "2026-10-10" });
  assert.deepEqual(allDay.end, { date: "2026-10-11" }, "en Google el fin de un día completo es exclusivo");
  const timed = outingToEvent({ id: 2, title: "Recital", date: "2026-11-14", startTime: "23:00", allDay: 0, status: "tentative", withWhom: "Kiara" });
  assert.equal(timed.start.dateTime, "2026-11-14T23:00:00");
  assert.equal(timed.end.dateTime, "2026-11-15T01:00:00", "cruza la medianoche");
  assert.equal(timed.status, "tentative");
  assert.deepEqual(timed.extendedProperties.private, { outingId: "2", category: "", withWhom: "Kiara", attendance: "tentative" });
  // 00:30 UTC del 15 = 21:30 del 14 en Buenos Aires.
  assert.deepEqual(toLocalParts("2026-11-15T00:30:00Z"), { date: "2026-11-14", time: "21:30" });
  const back = eventToOuting({ summary: "Cumple de Fede", start: { dateTime: "2026-11-07T21:00:00-03:00" }, end: { dateTime: "2026-11-08T02:00:00-03:00" }, status: "confirmed" });
  assert.equal(back.date, "2026-11-07");
  assert.equal(back.startTime, "21:00");
  assert.equal(back.endTime, null, "termina otro día: no se guarda como hora de fin");
  assert.equal(back.category, "celebracion");
});

test("App → Google: alta, sin cambios no vuelve a subir, edición y baja", async () => {
  const { db, cal, sync, addLocal, get, editLocal } = await setup();
  const id = await addLocal({ title: "Recital", date: "2026-11-14", startTime: "21:00", place: "Quality", category: "musica" });
  const s1 = await sync.syncNow();
  assert.equal(s1.pushedNew, 1);
  const local = await get(id);
  assert.ok(local.googleEventId);
  assert.equal(cal.events.get(local.googleEventId).location, "Quality");

  const s2 = await sync.syncNow();
  assert.deepEqual([s2.pushedNew, s2.pushedUpdated, s2.pulledUpdated, s2.pulledNew], [0, 0, 0, 0], "el eco de lo que subimos se ignora");

  await editLocal(id, { title: "Recital de Babasónicos" }, "2026-10-05T10:00:00.000Z");
  const s3 = await sync.syncNow();
  assert.equal(s3.pushedUpdated, 1);
  assert.equal(cal.events.get(local.googleEventId).summary, "Recital de Babasónicos");

  await editLocal(id, { deletedAt: "2026-10-06T10:00:00.000Z" }, "2026-10-06T10:00:00.000Z");
  const s4 = await sync.syncNow();
  assert.equal(s4.pushedDeleted, 1);
  assert.equal(await get(id), undefined);
  assert.equal(cal.events.get(local.googleEventId).status, "cancelled");
  assert.ok((await getAccount(db)).lastSyncAt);
});

test("Google → App: altas, cambios y bajas hechas en el calendario (con paginación)", async () => {
  const { db, cal, sync } = await setup();
  for (let i = 1; i <= 3; i++) cal.remoteCreate({ summary: `Partido ${i}`, start: { date: `2026-11-0${i}` }, end: { date: `2026-11-0${i + 1}` } });
  const fede = cal.remoteCreate({ summary: "Cumple de Fede", start: { dateTime: "2026-11-07T21:00:00-03:00" }, end: { dateTime: "2026-11-07T23:30:00-03:00" }, status: "tentative" });
  const s1 = await sync.syncNow();
  assert.equal(s1.pulledNew, 4);
  const row = await db.prepare("SELECT * FROM outings WHERE googleEventId = ?").get(fede.id);
  assert.equal(row.source, "google");
  assert.equal(row.status, "tentative");
  assert.equal(row.startTime, "21:00");
  assert.equal(row.endTime, "23:30");

  cal.remoteEdit(fede.id, { status: "confirmed", location: "Lo de Fede" });
  const s2 = await sync.syncNow();
  assert.equal(s2.pulledUpdated, 1);
  const updated = await db.prepare("SELECT * FROM outings WHERE googleEventId = ?").get(fede.id);
  assert.equal(updated.status, "confirmed");
  assert.equal(updated.place, "Lo de Fede");
  assert.equal(s2.pushedUpdated, 0, "lo bajado no se vuelve a subir");

  cal.remoteDelete(fede.id);
  const s3 = await sync.syncNow();
  assert.equal(s3.pulledDeleted, 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outings").get()).n, 3);
});

test("conflicto: gana el cambio más reciente y queda registrado", async () => {
  const { db, cal, sync, addLocal, get, editLocal } = await setup();
  const id = await addLocal({ title: "Asado", date: "2026-11-01" });
  await sync.syncNow();
  const gid = (await get(id)).googleEventId;

  // Google cambia antes; la app cambia después → gana la app.
  cal.remoteEdit(gid, { summary: "Asado (Google)" }, "2026-10-10T10:00:00.000Z");
  await editLocal(id, { title: "Asado (app)" }, "2026-10-20T10:00:00.000Z");
  const s1 = await sync.syncNow();
  assert.equal(s1.conflicts, 1);
  assert.equal(cal.events.get(gid).summary, "Asado (app)");
  assert.equal((await get(id)).title, "Asado (app)");

  // La app cambia antes; Google cambia después → gana Google.
  await editLocal(id, { title: "Asado (app 2)" }, "2026-10-21T10:00:00.000Z");
  cal.remoteEdit(gid, { summary: "Asado (Google 2)" }, "2026-10-25T10:00:00.000Z");
  const s2 = await sync.syncNow();
  assert.equal(s2.conflicts, 1);
  assert.equal((await get(id)).title, "Asado (Google 2)");
  const log = await db.prepare("SELECT kind, message FROM google_sync_log WHERE kind = 'conflict' ORDER BY id").all();
  assert.equal(log.length, 2);
  assert.match(log[0].message, /versión de la app/);
  assert.match(log[1].message, /versión de Google/);
});

test("si Google invalida el syncToken (410) hace una sync completa", async () => {
  const { db, cal, sync } = await setup();
  cal.remoteCreate({ summary: "Uno", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } });
  await sync.syncNow();
  cal.remoteCreate({ summary: "Dos", start: { date: "2026-11-02" }, end: { date: "2026-11-03" } });
  cal.expireTokens = true;
  const s = await sync.syncNow();
  assert.equal(s.fullResync, true);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM outings").get()).n, 2, "no duplica lo que ya tenía");
  assert.match((await db.prepare("SELECT message FROM google_sync_log WHERE kind = 'info'").get()).message, /completa/);
});

test("un error de Google queda en la cuenta y en el log (y 'revocado' pide reconectar)", async () => {
  const { db, sync, addLocal } = await setup();
  await addLocal({ title: "x", date: "2026-11-01" });
  const broken = createCalendarSync(db, {
    insertEvent: async () => {
      throw Object.assign(new Error("Token has been expired or revoked."), { status: 400, code: "invalid_grant" });
    },
  });
  await assert.rejects(broken.syncNow());
  assert.equal((await getAccount(db)).status, "revoked");
  assert.match((await getAccount(db)).lastError, /revoked/);
  void sync;
});
