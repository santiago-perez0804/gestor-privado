// Google Calendar: conectar (OAuth), estado, sincronizar, desconectar y log.
import { db } from "../db/index.js";
import { google } from "../services/google/index.js";

export default function registerGoogleRoutes(app) {
  app.get("/api/google/status", (req, res) => res.json(google().status()));

  // Paso 1 de OAuth: redirige a la pantalla de consentimiento de Google.
  app.get("/api/google/auth", (req, res) => {
    const status = google().status();
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
    if (!google().status().connected) return res.status(409).json({ error: "not_connected", status: google().status() });
    try {
      const stats = await google().sync();
      res.json({ stats, status: google().status() });
    } catch (err) {
      res.status(502).json({ error: err.message, status: google().status() });
    }
  });

  app.post("/api/google/disconnect", async (req, res) => {
    await google().auth.disconnect();
    res.json(google().status());
  });

  app.get("/api/google/log", (req, res) => {
    res.json(db.prepare("SELECT * FROM google_sync_log ORDER BY id DESC LIMIT 30").all());
  });
}
