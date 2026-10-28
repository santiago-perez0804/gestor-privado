// Google Calendar: conectar (OAuth), estado, sincronizar, desconectar y log.
import { db } from "../db/index.js";
import { google } from "../services/google/index.js";

export default function registerGoogleRoutes(app) {
  app.get("/api/google/status", async (req, res) => res.json(await google().status()));

  // Paso 1 de OAuth: redirige a la pantalla de consentimiento de Google.
  app.get("/api/google/auth", async (req, res) => {
    const status = await google().status();
    if (!status.configured) return res.status(400).json({ error: "google_not_configured" });
    res.redirect(google().auth.authUrl());
  });

  // Paso 2: Google vuelve acá con el código. Se guarda el token, se crea el calendario y se sincroniza.
  app.get("/api/google/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`/ocio/salidas?google=cancelado`);
    try {
      await google().auth.handleCallback({ code, state });
      await google().ensureCalendar();
      google()
        .sync()
        .catch(() => {});
      res.redirect("/ocio/salidas?google=conectado");
    } catch (err) {
      console.warn("[google] no se pudo conectar:", err.message);
      res.redirect(`/ocio/salidas?google=error&motivo=${encodeURIComponent(err.message)}`);
    }
  });

  app.post("/api/google/sync", async (req, res) => {
    const before = await google().status();
    if (!before.connected) return res.status(409).json({ error: "not_connected", status: before });
    try {
      const stats = await google().sync();
      res.json({ stats, status: await google().status() });
    } catch (err) {
      res.status(502).json({ error: err.message, status: await google().status() });
    }
  });

  app.post("/api/google/disconnect", async (req, res) => {
    await google().auth.disconnect();
    res.json(await google().status());
  });

  app.get("/api/google/log", async (req, res) => {
    res.json(await db.prepare("SELECT * FROM google_sync_log ORDER BY id DESC LIMIT 30").all());
  });
}
