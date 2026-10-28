// Sesión por cookies httpOnly (el JavaScript de la página no las puede leer). Con login activo,
// todo /api y todos los archivos piden sesión, salvo el login mismo y las tareas programadas (que
// tienen su propio secreto). Si el token de acceso venció, se renueva solo con el refresh token.
import { authEnabled, verifyAccessToken, refresh } from "../services/auth.js";

export const ACCESS_COOKIE = "gs_session";
export const REFRESH_COOKIE = "gs_refresh";
const REFRESH_MAX_AGE = 60 * 24 * 60 * 60; // 60 días: "recordarme" en el celular

/** Rutas sin sesión: login/estado y las tareas programadas (cron). */
const PUBLIC = [/^\/api\/auth\//, /^\/api\/cron\//];

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

const secure = (req) => req.secure || req.headers["x-forwarded-proto"] === "https" || !!process.env.VERCEL;

function cookie(name, value, { maxAge, req }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure(req)) parts.push("Secure");
  return parts.join("; ");
}

/** Guarda la sesión en cookies. */
export function setSessionCookies(req, res, s) {
  res.append("Set-Cookie", cookie(ACCESS_COOKIE, s.accessToken, { maxAge: Math.max(60, s.expiresIn), req }));
  res.append("Set-Cookie", cookie(REFRESH_COOKIE, s.refreshToken, { maxAge: REFRESH_MAX_AGE, req }));
}

export function clearSessionCookies(req, res) {
  res.append("Set-Cookie", cookie(ACCESS_COOKIE, "", { maxAge: 0, req }));
  res.append("Set-Cookie", cookie(REFRESH_COOKIE, "", { maxAge: 0, req }));
}

/** Lee (y si hace falta renueva) la sesión del pedido. Devuelve { email } o null. */
export async function currentUser(req, res) {
  const c = parseCookies(req.headers.cookie);
  const user = await verifyAccessToken(c[ACCESS_COOKIE]);
  if (user) return user;
  if (!c[REFRESH_COOKIE]) return null;
  const s = await refresh(c[REFRESH_COOKIE]);
  if (!s) {
    clearSessionCookies(req, res);
    return null;
  }
  setSessionCookies(req, res, s);
  return (await verifyAccessToken(s.accessToken)) ?? { email: s.email };
}

export function requireSession({ enabled = authEnabled } = {}) {
  return async (req, res, next) => {
    if (!enabled() || req.method === "OPTIONS" || PUBLIC.some((r) => r.test(req.path))) return next();
    try {
      const user = await currentUser(req, res);
      if (user) {
        req.user = user;
        // Las respuestas con datos personales no se guardan en cachés compartidas.
        if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "private, no-store");
        return next();
      }
      res.status(401).json({ error: "unauthenticated", message: "Iniciá sesión para seguir." });
    } catch (err) {
      next(err);
    }
  };
}
