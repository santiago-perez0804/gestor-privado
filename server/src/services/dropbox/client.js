// Dropbox: OAuth 2.0 (código + refresh token "offline") y lo mínimo de la API de archivos para leer
// el statistics.sqlite3 que sube KOReader. Con fetch y sin dependencias. El refresh token se guarda
// cifrado en la base (secretBox); el de acceso vive solo en memoria.
// Corre igual en la PC o en un backend en la nube: no depende de la carpeta local de Dropbox.
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, hasEncryptionKey } from "../../lib/secretBox.js";
import { backoffDelay } from "../catalog/http.js";

const AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
// Sobreescribibles solo para las pruebas (un Dropbox falso local).
const apiBase = () => process.env.DROPBOX_API_URL || "https://api.dropboxapi.com";
const contentBase = () => process.env.DROPBOX_CONTENT_URL || "https://content.dropboxapi.com";

export const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_PATH = "/statistics.sqlite3";

export class DropboxError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

export function dropboxConfig() {
  return {
    appKey: process.env.DROPBOX_APP_KEY,
    appSecret: process.env.DROPBOX_APP_SECRET,
    redirectUri: process.env.DROPBOX_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/api/dropbox/callback`,
  };
}

/** ¿Está todo en el .env? (credenciales de la app de Dropbox y la clave para cifrar el token). */
export function dropboxConfigured() {
  const c = dropboxConfig();
  return !!(c.appKey && c.appSecret && hasEncryptionKey());
}

/**
 * Ruta del archivo en Dropbox a partir de lo que escribe el usuario: una carpeta ("/kindle") o el
 * archivo ("/kindle/statistics.sqlite3"). Con una app de tipo "App folder", "/" es la carpeta de la app.
 */
export function normalizePath(input) {
  let p = String(input || "").trim().replace(/\\/g, "/");
  if (!p || p === "/") return DEFAULT_PATH;
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+/g, "/").replace(/\/$/, "");
  if (p.split("/").some((part) => part === "..")) throw new DropboxError(400, "invalid_path");
  return /\.sqlite3?$/i.test(p) ? p : `${p}/statistics.sqlite3`;
}

// ---------- cuenta (una sola fila) ----------
export async function getAccount(db) {
  return await db.prepare("SELECT * FROM dropbox_account WHERE id = 1").get() ?? null;
}

export async function saveAccount(db, fields) {
  const merged = { status: "disconnected", path: DEFAULT_PATH, ...await getAccount(db), ...fields, updatedAt: nowIso() };
  const cols = ["refreshTokenEnc", "email", "path", "lastRev", "lastSyncAt", "lastCheckAt", "lastError", "lastSummary", "status", "updatedAt"];
  await db.prepare(
    `INSERT INTO dropbox_account (id, ${cols.join(", ")}) VALUES (1, ${cols.map(() => "?").join(", ")})
     ON CONFLICT(id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}`
  ).run(...cols.map((c) => merged[c] ?? null));
  return await getAccount(db);
}

// ---------- OAuth ----------
export function createDropboxAuth(db, { fetchImpl = fetch } = {}) {
  let access = null; // { token, expiresAt }
  const pendingStates = new Map(); // state → creado (anti-CSRF del callback)

  function authUrl() {
    const c = dropboxConfig();
    const state = randomBytes(16).toString("hex");
    pendingStates.set(state, Date.now());
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", c.appKey);
    url.searchParams.set("redirect_uri", c.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("token_access_type", "offline"); // para recibir un refresh token
    url.searchParams.set("state", state);
    return url.toString();
  }

  async function tokenRequest(params) {
    const c = dropboxConfig();
    const res = await fetchImpl(`${apiBase()}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.appKey, client_secret: c.appSecret, ...params }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new DropboxError(res.status, data.error_description || data.error || `token_${res.status}`, data.error);
    return data;
  }

  async function currentEmail(token) {
    try {
      const res = await fetchImpl(`${apiBase()}/2/users/get_current_account`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? (await res.json()).email ?? null : null;
    } catch {
      return null; // sin el permiso account_info.read no hay email: no es grave
    }
  }

  /** Callback: valida el state, cambia el código por tokens y guarda el refresh token cifrado. */
  async function handleCallback({ code, state }) {
    const created = pendingStates.get(state);
    pendingStates.delete(state);
    if (!created || Date.now() - created > 10 * 60_000) throw new DropboxError(400, "invalid_state");
    const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: dropboxConfig().redirectUri });
    if (!t.refresh_token) throw new DropboxError(400, "Dropbox no devolvió un refresh token. Volvé a conectar.");
    access = { token: t.access_token, expiresAt: Date.now() + ((t.expires_in || 14_400) - 60) * 1000 };
    return await saveAccount(db, { refreshTokenEnc: encryptSecret(t.refresh_token), email: await currentEmail(t.access_token), status: "connected", lastError: null, lastRev: null });
  }

  /** Token de acceso vigente (lo renueva con el refresh token si venció). */
  async function getAccessToken({ force = false } = {}) {
    if (!force && access && access.expiresAt > Date.now()) return access.token;
    const account = await getAccount(db);
    if (!account?.refreshTokenEnc) throw new DropboxError(401, "not_connected", "not_connected");
    try {
      const t = await tokenRequest({ refresh_token: decryptSecret(account.refreshTokenEnc), grant_type: "refresh_token" });
      access = { token: t.access_token, expiresAt: Date.now() + ((t.expires_in || 14_400) - 60) * 1000 };
      return access.token;
    } catch (err) {
      if (err.code === "invalid_grant") await saveAccount(db, { status: "revoked", lastError: "Dropbox revocó el acceso: hay que reconectar." });
      throw err;
    }
  }

  async function disconnect() {
    const account = await getAccount(db);
    if (account?.refreshTokenEnc) {
      try {
        const token = await getAccessToken();
        await fetchImpl(`${apiBase()}/2/auth/token/revoke`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      } catch {
        // si no se pudo revocar allá, igual se olvida acá
      }
    }
    access = null;
    await saveAccount(db, { refreshTokenEnc: null, email: null, status: "disconnected", lastRev: null, lastError: null });
  }

  return { authUrl, handleCallback, getAccessToken, disconnect };
}

// ---------- archivos ----------
/** Encabezado Dropbox-API-Arg: JSON con los caracteres no ASCII escapados (va en un header HTTP). */
const apiArg = (obj) => JSON.stringify(obj).replace(/[\u007f-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);

/**
 * Lo mínimo de la API de archivos, con reintentos ante 429/5xx y un reintento con token nuevo ante 401.
 * @param {(opts?: { force?: boolean }) => Promise<string>} getAccessToken
 */
export function createDropboxFiles(getAccessToken, { fetchImpl = fetch, backoff = backoffDelay } = {}) {
  async function call(url, init, { retries = 3 } = {}) {
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await getAccessToken({ force: refreshed });
      const res = await fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(backoff(attempt, res.headers.get("retry-after")));
        continue;
      }
      return res;
    }
  }

  /** Metadatos del archivo, o null si no existe todavía (el Kindle nunca sincronizó). */
  async function getMetadata(path) {
    const res = await call(`${apiBase()}/2/files/get_metadata`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && String(data.error_summary || "").startsWith("path/not_found")) return null;
    if (!res.ok) throw new DropboxError(res.status, data.error_summary || `metadata_${res.status}`, data.error?.[".tag"]);
    if (data[".tag"] && data[".tag"] !== "file") throw new DropboxError(400, "La ruta de Dropbox es una carpeta, no el archivo.", "not_file");
    return { rev: data.rev, size: data.size, serverModified: data.server_modified, contentHash: data.content_hash };
  }

  /** Contenido del archivo (Buffer). */
  async function download(path) {
    const res = await call(`${contentBase()}/2/files/download`, { method: "POST", headers: { "Dropbox-API-Arg": apiArg({ path }) } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new DropboxError(res.status, `download_${res.status} ${text.slice(0, 120)}`);
    }
    const declared = Number(res.headers.get("content-length"));
    if (declared > MAX_DOWNLOAD_BYTES) throw new DropboxError(413, "El archivo de Dropbox es demasiado grande.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) throw new DropboxError(413, "El archivo de Dropbox es demasiado grande.");
    return buf;
  }

  return { getMetadata, download };
}
