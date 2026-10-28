// Login con Supabase Auth (API REST, sin SDK) y verificación de la sesión en el server.
// - Solo entra el dueño: OWNER_EMAIL (los registros están apagados en Supabase; esto es un segundo cerrojo).
// - El token de acceso (JWT, ~1 h) se verifica acá con las claves públicas del proyecto (JWKS) o,
//   en proyectos con la clave vieja, con SUPABASE_JWT_SECRET (HS256). Si no hay ninguna de las dos,
//   se le pregunta a Supabase quién es (más lento, pero anda).
// - El refresh token renueva la sesión sin volver a pedir la contraseña.
import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "node:crypto";

const authUrl = () => `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
const apiKey = () => process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const err = (status, message, userMessage) => Object.assign(new Error(message), { status, userMessage });

/** ¿Hay login? (en la nube siempre; en local, solo si se configura Supabase o se fuerza). */
export const authEnabled = () => !!(process.env.SUPABASE_URL && apiKey()) || process.env.AUTH_REQUIRED === "1";
export const ownerEmail = () => String(process.env.OWNER_EMAIL || "").trim().toLowerCase();
export const isOwner = (email) => !!ownerEmail() && String(email || "").trim().toLowerCase() === ownerEmail();

async function gotrue(path, { method = "POST", body, token } = {}) {
  const r = await fetch(`${authUrl()}${path}`, {
    method,
    headers: { apikey: apiKey(), "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

const session = (d) => ({ accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in ?? 3600, email: d.user?.email ?? null });

/** Email y contraseña → sesión. Mismo mensaje para "no sos el dueño" y "contraseña mal". */
export async function login(email, password) {
  const wrong = err(401, "invalid_credentials", "Email o contraseña incorrectos.");
  if (!email || !password) throw wrong;
  if (!isOwner(email)) throw wrong;
  const r = await gotrue("/token?grant_type=password", { body: { email: String(email).trim(), password: String(password) } });
  if (r.status === 429) throw err(429, "too_many_attempts", "Demasiados intentos. Esperá un rato y probá de nuevo.");
  if (!r.ok) throw wrong;
  const s = session(r.data);
  if (!isOwner(s.email)) throw wrong;
  return s;
}

/** Refresh token → sesión nueva (o null si ya no sirve). */
export async function refresh(refreshToken) {
  if (!refreshToken) return null;
  const r = await gotrue("/token?grant_type=refresh_token", { body: { refresh_token: refreshToken } });
  if (!r.ok) return null;
  const s = session(r.data);
  return isOwner(s.email) ? s : null;
}

/** Cierra la sesión en Supabase (invalida el refresh token). */
export async function logout(accessToken) {
  if (!accessToken) return;
  await gotrue("/logout?scope=local", { token: accessToken }).catch(() => {});
}

// ---------- verificación del JWT ----------

const b64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
let jwks = { keys: [], at: 0 };

async function publicKey(kid) {
  const fresh = Date.now() - jwks.at < 10 * 60_000;
  if (!fresh || (kid && !jwks.keys.some((k) => k.kid === kid))) {
    try {
      const r = await fetch(`${authUrl()}/.well-known/jwks.json`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) jwks = { keys: (await r.json()).keys || [], at: Date.now() };
    } catch {
      // sin red: se usa lo que había
    }
  }
  const jwk = jwks.keys.find((k) => k.kid === kid) ?? (jwks.keys.length === 1 ? jwks.keys[0] : null);
  return jwk ? createPublicKey({ key: jwk, format: "jwk" }) : null;
}

/** Cache corto de "quién es" para el modo sin claves (se le pregunta a Supabase). */
const userCache = new Map();

/**
 * Verifica un token de acceso. Devuelve { email, sub, exp } o null (inválido, vencido o no es del dueño).
 * @param {string} token
 */
export async function verifyAccessToken(token, { now = Date.now() } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  let header;
  let payload;
  try {
    header = JSON.parse(b64(parts[0]).toString("utf8"));
    payload = JSON.parse(b64(parts[1]).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp * 1000 <= now) return null;
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = b64(parts[2]);
  let ok = false;
  if (header.alg === "HS256") {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (secret) {
      const expected = createHmac("sha256", secret).update(data).digest();
      ok = expected.length === sig.length && timingSafeEqual(expected, sig);
    } else {
      // Sin la clave: se le pregunta a Supabase (y se recuerda un minuto).
      const hit = userCache.get(token);
      if (hit && hit.until > now) ok = hit.ok;
      else {
        const r = await gotrue("/user", { method: "GET", token }).catch(() => ({ ok: false }));
        ok = r.ok && r.data?.email?.toLowerCase() === String(payload.email || "").toLowerCase();
        userCache.set(token, { ok, until: now + 60_000 });
        if (userCache.size > 200) userCache.clear();
      }
    }
  } else if (header.alg === "ES256" || header.alg === "RS256") {
    const key = await publicKey(header.kid);
    if (key) ok = header.alg === "ES256" ? cryptoVerify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, sig) : cryptoVerify("RSA-SHA256", data, key, sig);
  }
  if (!ok) return null;
  if (payload.aud && payload.aud !== "authenticated" && !(Array.isArray(payload.aud) && payload.aud.includes("authenticated"))) return null;
  if (!isOwner(payload.email)) return null;
  return { email: payload.email, sub: payload.sub, exp: payload.exp };
}
