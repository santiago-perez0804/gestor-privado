// KOReader por Dropbox: arma auth + archivos + importación y decide cuándo revisar
// (al arrancar, cada 15 minutos y al abrir las pantallas de lectura si pasó un rato).
import { db, importsDir } from "../../db/index.js";
import { createLibrary } from "../ocio/library.js";
import { createKoreaderSync } from "../ocio/koreaderSync.js";
import { createDropboxAuth, createDropboxFiles, dropboxConfigured, dropboxConfig, getAccount, saveAccount, normalizePath } from "./client.js";

const CHECK_EVERY_MS = 15 * 60_000;
const STALE_MS = 2 * 60_000;

function createKoreaderDropbox() {
  const auth = createDropboxAuth(db);
  const files = createDropboxFiles(auth.getAccessToken);
  const engine = createKoreaderSync({ db, lib: createLibrary(db), files, importsDir });
  let running = null;

  const connected = () => {
    const a = getAccount(db);
    return !!a?.refreshTokenEnc && a.status !== "revoked";
  };

  /** Revisa ya (si ya hay una revisión en curso, devuelve esa misma). */
  function sync({ force = false } = {}) {
    if (!running)
      running = engine.syncNow({ force }).finally(() => {
        running = null;
      });
    return running;
  }

  /** Revisa solo si pasó un rato desde la última vez (lo llaman las pantallas al abrirse). */
  function syncIfStale() {
    const last = getAccount(db)?.lastCheckAt;
    if (!connected() || (last && Date.now() - new Date(last).getTime() < STALE_MS)) return Promise.resolve({ changed: false, fresh: true });
    return sync();
  }

  function start() {
    if (connected()) setTimeout(() => sync().catch(() => {}), 8000);
    setInterval(() => connected() && sync().catch(() => {}), CHECK_EVERY_MS).unref?.();
  }

  function setPath(input) {
    // Otra ruta: se olvida el rev para que la próxima revisión baje el archivo nuevo.
    saveAccount(db, { path: normalizePath(input), lastRev: null, lastError: null });
    return status();
  }

  function status() {
    const a = getAccount(db);
    return {
      configured: dropboxConfigured(),
      redirectUri: dropboxConfig().redirectUri,
      connected: connected(),
      needsReconnect: a?.status === "revoked",
      status: a?.status ?? "disconnected",
      email: a?.email ?? null,
      syncing: !!running,
      ...engine.info(),
    };
  }

  return { auth, sync, syncIfStale, start, status, setPath, pending: engine.pending, resolve: engine.resolve, pendingCount: engine.pendingCount };
}

let service = null;
/** Servicio único (se crea al primer uso). */
export function koreaderDropbox() {
  if (!service) service = createKoreaderDropbox();
  return service;
}
