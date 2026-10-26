// Google Calendar: arma auth + cliente + motor de sincronización y decide cuándo sincronizar
// (al arrancar, cada 10 minutos y unos segundos después de cada cambio en una salida).
import { db } from "../../db/index.js";
import { createGoogleAuth, createCalendarClient, googleConfigured, googleConfig } from "./calendarClient.js";
import { createCalendarSync, getAccount, saveAccount } from "./sync.js";

const SYNC_EVERY_MS = 10 * 60_000;

function createGoogleService() {
  const auth = createGoogleAuth(db);
  const client = createCalendarClient(auth.getAccessToken);
  const engine = createCalendarSync(db, client);
  let running = null;
  let soonTimer = null;

  const connected = () => {
    const a = getAccount(db);
    return !!a?.refreshTokenEnc && (a.status === "connected" || a.status === "error");
  };

  /** El calendario dedicado "Salidas" (se crea la primera vez). */
  async function ensureCalendar() {
    const account = getAccount(db);
    if (account?.calendarId) return account;
    const cal = await client.createCalendar("Salidas");
    return saveAccount(db, { calendarId: cal.id, calendarName: cal.summary, syncToken: null });
  }

  /** Sincroniza ya (si ya hay una en curso, devuelve esa misma). */
  function sync() {
    if (!running)
      running = (async () => {
        try {
          await ensureCalendar();
          return await engine.syncNow();
        } finally {
          running = null;
        }
      })();
    return running;
  }

  /** Después de un cambio local: espera un poco (por si vienen más) y sube. */
  function scheduleSoon(ms = 3000) {
    if (!connected()) return;
    clearTimeout(soonTimer);
    soonTimer = setTimeout(() => sync().catch(() => {}), ms);
  }

  function start() {
    if (connected()) setTimeout(() => sync().catch(() => {}), 5000);
    setInterval(() => connected() && sync().catch(() => {}), SYNC_EVERY_MS).unref?.();
  }

  function status() {
    const a = getAccount(db);
    return {
      configured: googleConfigured(),
      redirectUri: googleConfig().redirectUri,
      status: a?.status ?? "disconnected",
      connected: connected(),
      needsReconnect: a?.status === "revoked",
      email: a?.email ?? null,
      calendarName: a?.calendarName ?? null,
      lastSyncAt: a?.lastSyncAt ?? null,
      lastError: a?.lastError ?? null,
      syncing: !!running,
    };
  }

  return { auth, sync, scheduleSoon, start, status, ensureCalendar };
}

let service = null;
/** Servicio único de Google (se crea al primer uso). */
export function google() {
  if (!service) service = createGoogleService();
  return service;
}
