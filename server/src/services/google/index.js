// Google Calendar: arma auth + cliente + motor de sincronización y decide cuándo sincronizar
// (al arrancar, cada 10 minutos y unos segundos después de cada cambio en una salida).
import { db } from "../../db/index.js";
import { createGoogleAuth, createCalendarClient, googleConfigured, googleConfig } from "./calendarClient.js";
import { createCalendarSync, getAccount, saveAccount } from "./sync.js";
import { background } from "../../lib/background.js";

const SYNC_EVERY_MS = 10 * 60_000;

function createGoogleService() {
  const auth = createGoogleAuth(db);
  const client = createCalendarClient(auth.getAccessToken);
  const engine = createCalendarSync(db, client);
  let running = null;
  let soonTimer = null;

  const connected = async () => {
    const a = await getAccount(db);
    return !!a?.refreshTokenEnc && (a.status === "connected" || a.status === "error");
  };

  /** El calendario dedicado "Salidas" (se crea la primera vez). */
  async function ensureCalendar() {
    const account = await getAccount(db);
    if (account?.calendarId) return account;
    const cal = await client.createCalendar("Salidas");
    return await saveAccount(db, { calendarId: cal.id, calendarName: cal.summary, syncToken: null });
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

  /**
   * Después de un cambio local: espera un poco (por si vienen más) y sube. En la nube se sube ya,
   * en segundo plano (la función no queda viva para un temporizador).
   */
  async function scheduleSoon(ms = 3000) {
    if (!await connected()) return;
    if (process.env.VERCEL) return void background(sync());
    clearTimeout(soonTimer);
    soonTimer = setTimeout(() => sync().catch(() => {}), ms);
  }

  async function start() {
    if (await connected()) setTimeout(() => sync().catch(() => {}), 5000);
    setInterval(async () => await connected() && sync().catch(() => {}), SYNC_EVERY_MS).unref?.();
  }

  async function status() {
    const a = await getAccount(db);
    return {
      configured: googleConfigured(),
      redirectUri: googleConfig().redirectUri,
      status: a?.status ?? "disconnected",
      connected: await connected(),
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
