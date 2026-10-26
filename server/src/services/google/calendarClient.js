// Google: OAuth 2.0 (código + refresh token) y la API de Calendar, con fetch y sin dependencias.
// El refresh token se guarda cifrado en la base (secretBox); el de acceso solo en memoria.
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, hasEncryptionKey } from "../../lib/secretBox.js";
import { backoffDelay } from "../catalog/http.js";
import { getAccount, saveAccount } from "./sync.js";
import { TIME_ZONE } from "./eventMapping.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
// Mínimo necesario: calendarios creados por esta app (crear "Salidas" y sus eventos). No da acceso
// al calendario principal ni a otros. Se puede cambiar con GOOGLE_CALENDAR_SCOPE si hiciera falta.
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

export class GoogleError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/api/google/callback`,
    scope: process.env.GOOGLE_CALENDAR_SCOPE || DEFAULT_SCOPE,
  };
}

/** ¿Está todo lo necesario en el .env? (credenciales de OAuth y la clave para cifrar el token). */
export function googleConfigured() {
  const c = googleConfig();
  return !!(c.clientId && c.clientSecret && hasEncryptionKey());
}

/** El email viene en el id_token (JWT firmado por Google, recibido por TLS directo de Google). */
function emailFromIdToken(idToken) {
  try {
    return JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")).email ?? null;
  } catch {
    return null;
  }
}

export function createGoogleAuth(db, { fetchImpl = fetch } = {}) {
  let access = null; // { token, expiresAt }
  const pendingStates = new Map(); // state → creado (anti-CSRF del callback)

  function authUrl() {
    const c = googleConfig();
    const state = randomBytes(16).toString("hex");
    pendingStates.set(state, Date.now());
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", c.clientId);
    url.searchParams.set("redirect_uri", c.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", `openid email ${c.scope}`);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent"); // asegura que Google mande el refresh token
    url.searchParams.set("state", state);
    return url.toString();
  }

  async function tokenRequest(params) {
    const c = googleConfig();
    const res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new GoogleError(res.status, data.error_description || data.error || `token_${res.status}`, data.error);
    return data;
  }

  /** Callback de OAuth: valida el state, cambia el código por tokens y guarda el refresh cifrado. */
  async function handleCallback({ code, state }) {
    const created = pendingStates.get(state);
    pendingStates.delete(state);
    if (!created || Date.now() - created > 10 * 60_000) throw new GoogleError(400, "invalid_state");
    const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleConfig().redirectUri });
    if (!t.refresh_token) throw new GoogleError(400, "Google no devolvió un refresh token. Quitá el acceso de la app en tu cuenta de Google y volvé a conectar.");
    access = { token: t.access_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000 };
    return saveAccount(db, { refreshTokenEnc: encryptSecret(t.refresh_token), email: emailFromIdToken(t.id_token), status: "connected", lastError: null, syncToken: null });
  }

  /** Token de acceso vigente (lo renueva con el refresh token si venció). */
  async function getAccessToken({ force = false } = {}) {
    if (!force && access && access.expiresAt > Date.now()) return access.token;
    const account = getAccount(db);
    if (!account?.refreshTokenEnc) throw new GoogleError(401, "not_connected", "not_connected");
    try {
      const t = await tokenRequest({ refresh_token: decryptSecret(account.refreshTokenEnc), grant_type: "refresh_token" });
      access = { token: t.access_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000 };
      return access.token;
    } catch (err) {
      if (err.code === "invalid_grant") saveAccount(db, { status: "revoked", lastError: "Google revocó el acceso: hay que reconectar." });
      throw err;
    }
  }

  async function disconnect() {
    const account = getAccount(db);
    if (account?.refreshTokenEnc) {
      await fetchImpl(`${REVOKE_URL}?token=${encodeURIComponent(decryptSecret(account.refreshTokenEnc))}`, { method: "POST" }).catch(() => {});
    }
    access = null;
    saveAccount(db, { refreshTokenEnc: null, status: "disconnected", syncToken: null, lastError: null });
  }

  return { authUrl, handleCallback, getAccessToken, disconnect };
}

/** API de Calendar con reintentos (429 / 5xx) y un reintento con token nuevo ante 401. */
export function createCalendarClient(getAccessToken, { fetchImpl = fetch, retries = 3, backoff = backoffDelay } = {}) {
  async function request(method, path, { query, body, etag } = {}) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, v);
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const headers = { Authorization: `Bearer ${await getAccessToken({ force: refreshed })}`, Accept: "application/json" };
      if (body) headers["Content-Type"] = "application/json";
      if (etag) headers["If-Match"] = etag;
      let res;
      try {
        res = await fetchImpl(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
      } catch {
        if (attempt < retries) {
          await sleep(backoff(attempt));
          continue;
        }
        throw new GoogleError(0, "Sin conexión con Google Calendar");
      }
      if (res.status === 204) return null;
      const data = await res.json().catch(() => null);
      if (res.ok) return data;
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(backoff(attempt, res.headers.get("retry-after")));
        continue;
      }
      throw new GoogleError(res.status, data?.error?.message || `calendar_${res.status}`);
    }
  }

  const cal = (id) => `/calendars/${encodeURIComponent(id)}`;
  return {
    listEvents: (calendarId, { syncToken, pageToken }) =>
      request("GET", `${cal(calendarId)}/events`, { query: { syncToken, pageToken, showDeleted: "true", singleEvents: "true", maxResults: "250" } }),
    getEvent: (calendarId, id) => request("GET", `${cal(calendarId)}/events/${encodeURIComponent(id)}`),
    insertEvent: (calendarId, event) => request("POST", `${cal(calendarId)}/events`, { body: event }),
    patchEvent: (calendarId, id, event, etag) => request("PATCH", `${cal(calendarId)}/events/${encodeURIComponent(id)}`, { body: event, etag }),
    deleteEvent: (calendarId, id) => request("DELETE", `${cal(calendarId)}/events/${encodeURIComponent(id)}`),
    createCalendar: (summary) => request("POST", "/calendars", { body: { summary, timeZone: TIME_ZONE, description: "Salidas del gestor (se sincroniza solo)." } }),
  };
}
