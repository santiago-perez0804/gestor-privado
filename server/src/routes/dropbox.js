// Dropbox para la sincronización automática de KOReader: conectar (OAuth), estado, revisar ahora,
// ruta del archivo y la bandeja de libros pendientes de confirmar.
import { handle } from "../lib/http.js";
import { koreaderDropbox } from "../services/dropbox/index.js";

export default function registerDropboxRoutes(app) {
  const svc = () => koreaderDropbox();

  app.get("/api/dropbox/status", handle(() => svc().status()));

  // Paso 1 de OAuth: a la pantalla de permisos de Dropbox.
  app.get("/api/dropbox/auth", (req, res) => {
    if (!svc().status().configured) return res.status(400).json({ error: "dropbox_not_configured" });
    res.redirect(svc().auth.authUrl());
  });

  // Paso 2: Dropbox vuelve acá con el código. Se guarda el token y se revisa enseguida.
  app.get("/api/dropbox/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.redirect("/ocio/biblioteca/libros?dropbox=cancelado");
    try {
      await svc().auth.handleCallback({ code, state });
      svc()
        .sync()
        .catch(() => {});
      res.redirect("/ocio/biblioteca/libros?dropbox=conectado");
    } catch (err) {
      console.warn("[dropbox] no se pudo conectar:", err.message);
      res.redirect(`/ocio/biblioteca/libros?dropbox=error&motivo=${encodeURIComponent(err.message)}`);
    }
  });

  app.post("/api/dropbox/disconnect", async (req, res) => {
    await svc().auth.disconnect();
    res.json(svc().status());
  });

  app.put("/api/ocio/koreader/sync-settings", handle((req) => svc().setPath(req.body?.path)));

  // Revisar ahora. { ifStale: true } = solo si pasó un rato (lo usan las pantallas al abrirse).
  app.post("/api/ocio/koreader/sync", async (req, res) => {
    if (!svc().status().connected) return res.status(409).json({ error: "not_connected", status: svc().status() });
    try {
      const result = req.body?.ifStale ? await svc().syncIfStale() : await svc().sync({ force: !!req.body?.force });
      res.json({ result, status: svc().status() });
    } catch (err) {
      res.status(502).json({ error: err.message, status: svc().status() });
    }
  });

  app.get("/api/ocio/koreader/pending", handle(() => svc().pending()));
  app.post("/api/ocio/koreader/pending", handle((req) => svc().resolve(req.body?.mapping || {})));
}
