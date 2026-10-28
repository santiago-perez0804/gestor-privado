// Login: iniciar y cerrar sesión, y saber si hay sesión (la web lo pregunta al abrir).
import { authEnabled, login, logout } from "../services/auth.js";
import { currentUser, setSessionCookies, clearSessionCookies, parseCookies, ACCESS_COOKIE } from "../middleware/session.js";

// Freno simple a probar contraseñas: por IP, en memoria (Supabase además limita por su lado).
const attempts = new Map();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, list);
  return list.length >= MAX_ATTEMPTS;
}

export default function registerAuthRoutes(app) {
  app.get("/api/auth/session", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!authEnabled()) return res.json({ authRequired: false, authenticated: true, email: null });
    const user = await currentUser(req, res);
    res.json({ authRequired: true, authenticated: !!user, email: user?.email ?? null });
  });

  app.post("/api/auth/login", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!authEnabled()) return res.json({ authRequired: false, authenticated: true });
    const ip = req.ip || req.socket?.remoteAddress || "?";
    if (tooMany(ip)) return res.status(429).json({ error: "too_many_attempts", message: "Demasiados intentos. Esperá unos minutos." });
    try {
      const s = await login(req.body?.email, req.body?.password);
      attempts.delete(ip);
      setSessionCookies(req, res, s);
      res.json({ authRequired: true, authenticated: true, email: s.email });
    } catch (err) {
      attempts.get(ip).push(Date.now());
      res.status(err.status || 500).json({ error: err.message, message: err.userMessage || "No se pudo iniciar sesión." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    await logout(parseCookies(req.headers.cookie)[ACCESS_COOKIE]);
    clearSessionCookies(req, res);
    res.json({ authenticated: false });
  });
}
