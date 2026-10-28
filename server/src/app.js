// La app de Express: middlewares de seguridad, archivos y todas las rutas de la API. La usan el
// server local (index.js) y la función de Vercel (api/index.js). No arranca tareas ni escucha puertos.
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { openDb } from "./db/index.js";
import { asyncRoutes } from "./lib/asyncRoutes.js";
import { requestGuard, securityHeaders, DEV_ORIGINS } from "./middleware/requestGuard.js";
import { basicAuth } from "./middleware/basicAuth.js";
import { requireSession } from "./middleware/session.js";
import { authEnabled } from "./services/auth.js";
import registerAuthRoutes from "./routes/auth.js";
import registerCronRoutes from "./routes/cron.js";
import { catchUpToday } from "./services/cron.js";
import { storage, SAFE_KEY } from "./services/storage/index.js";

import registerWeightsRoutes from "./routes/weights.js";
import registerSettingsRoutes from "./routes/settings.js";
import registerPlansRoutes from "./routes/plans.js";
import registerFisicoRoutes from "./routes/fisico.js";
import registerExpensesRoutes from "./routes/expenses.js";
import registerRecurringExpensesRoutes from "./routes/recurringExpenses.js";
import registerBudgetsRoutes from "./routes/budgets.js";
import registerExchangeRateRoutes from "./routes/exchangeRate.js";
import registerOcioRoutes from "./routes/ocio.js";
import registerCatalogRoutes from "./routes/catalog.js";
import registerGoogleRoutes from "./routes/google.js";
import registerKoreaderRoutes from "./routes/koreader.js";
import registerGalleryRoutes from "./routes/gallery.js";
import registerDropboxRoutes from "./routes/dropbox.js";
import registerOutingsRoutes from "./routes/outings.js";
import registerProjectsRoutes from "./routes/projects.js";
import registerCertificatesRoutes from "./routes/certificates.js";
import registerExportRoutes from "./routes/export.js";
import registerIncomesRoutes from "./routes/incomes.js";
import registerSavingsGoalsRoutes from "./routes/savingsGoals.js";
import registerRecurringIncomesRoutes from "./routes/recurringIncomes.js";
import registerAccountsRoutes from "./routes/accounts.js";
import registerDebtsRoutes from "./routes/debts.js";
import registerMarketRoutes from "./routes/market.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Archivos de un bucket servidos por nombre (portadas, atril, certificados). */
function serveBucket(bucket, cacheControl) {
  return async (req, res) => {
    const key = req.params.key;
    if (!SAFE_KEY.test(key)) return res.status(404).json({ error: "not_found" });
    await storage(bucket).serve(res, key, { cacheControl, expiresIn: 3600 });
  };
}

/**
 * @param {{ serveWeb?: boolean }} [opts] serveWeb: servir también la web compilada (server local / app
 *   de escritorio). En Vercel la web la sirve Vercel.
 */
export function createApp({ serveWeb = true } = {}) {
  const app = asyncRoutes(express());
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.VERCEL ? 1 : false);
  app.use(securityHeaders);
  // Con login (nube) se acepta cualquier dominio: lo que protege es la sesión. Sin login, solo este equipo.
  app.use(requestGuard({ authConfigured: () => authEnabled() || !!(process.env.AUTH_USER && process.env.AUTH_PASS) }));
  // CORS solo para el front de desarrollo (Vite); la app y el widget se sirven desde el mismo origen.
  app.use(cors({ origin: DEV_ORIGINS }));
  app.use(express.json({ limit: "1mb" }));
  app.use(basicAuth);
  registerAuthRoutes(app);
  app.use(requireSession());
  // La base se abre una sola vez (en Vercel, en el primer pedido de cada instancia). El primer
  // pedido del día además genera los gastos e ingresos fijos que vencieron.
  app.use(async (req, res, next) => {
    try {
      await openDb();
      if (req.path.startsWith("/api/") && !req.path.startsWith("/api/cron/")) await catchUpToday();
      next();
    } catch (err) {
      next(err);
    }
  });

  // Archivos: los nombres incluyen un id aleatorio, así que se pueden cachear (en la nube, la
  // redirección a la URL firmada se cachea menos que lo que dura la firma).
  registerCronRoutes(app);
  app.get("/covers/:key", serveBucket("covers", "private, max-age=3000"));
  app.get("/artworks/:key", serveBucket("artworks", "private, max-age=3000"));
  app.get("/certificates/:key", serveBucket("certificates", "private, max-age=600"));

  registerWeightsRoutes(app);
  registerSettingsRoutes(app);
  registerPlansRoutes(app);
  registerFisicoRoutes(app);
  registerExpensesRoutes(app);
  registerRecurringExpensesRoutes(app);
  registerBudgetsRoutes(app);
  registerExchangeRateRoutes(app);
  registerOcioRoutes(app);
  registerCatalogRoutes(app);
  registerGoogleRoutes(app);
  registerKoreaderRoutes(app);
  registerGalleryRoutes(app);
  registerDropboxRoutes(app);
  registerOutingsRoutes(app);
  registerProjectsRoutes(app);
  registerCertificatesRoutes(app);
  registerIncomesRoutes(app);
  registerSavingsGoalsRoutes(app);
  registerRecurringIncomesRoutes(app);
  registerAccountsRoutes(app);
  registerDebtsRoutes(app);
  registerMarketRoutes(app);
  registerExportRoutes(app);

  // Una ruta de la API que no existe: 404 en JSON (no la página de la web).
  app.all(/^\/api\//, (req, res) => res.status(404).json({ error: "not_found" }));

  const webDistPath = join(__dirname, "..", "..", "web", "dist");
  if (serveWeb && existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get(/^(?!\/api|\/certificates|\/covers|\/artworks).*/, (req, res) => {
      res.sendFile(join(webDistPath, "index.html"));
    });
  }

  app.use((err, req, res, next) => {
    // Datos inválidos que frena la base (CHECK, UNIQUE, FOREIGN KEY): es un error del pedido, no del server.
    if (err.code === "ERR_SQLITE_ERROR" && /constraint failed/i.test(err.message)) {
      return res.status(/UNIQUE/i.test(err.message) ? 409 : 400).json({ error: err.message });
    }
    // JSON mal formado en el cuerpo del pedido.
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "invalid_json" });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(err);
    // En producción no se filtran detalles internos (consultas, rutas) al cliente.
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? "internal_error" : err.message || "internal_error" });
  });

  return app;
}
