// Primero: variables de entorno (.env) para que el resto de los módulos ya las vea.
import "./env.js";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { db, photosDir, certificatesDir, coversDir, artworksDir } from "./db/index.js";
import { seedExerciseLibrary } from "./db/seedExerciseLibrary.js";
import { generateDueRecurringExpenses, generateDueRecurringIncomes } from "./services/recurringExpenses.js";
import { startDailyBackups } from "./services/backup.js";
import { startInstagramSync } from "./services/instagramSync.js";
import { basicAuth } from "./middleware/basicAuth.js";
import { requestGuard, securityHeaders, DEV_ORIGINS } from "./middleware/requestGuard.js";

import registerWeightsRoutes from "./routes/weights.js";
import registerSettingsRoutes from "./routes/settings.js";
import registerPlansRoutes from "./routes/plans.js";
import registerFisicoRoutes from "./routes/fisico.js";
import registerExerciseLogsRoutes from "./routes/exerciseLogs.js";
import registerProgressPhotosRoutes from "./routes/progressPhotos.js";
import registerExpensesRoutes from "./routes/expenses.js";
import registerRecurringExpensesRoutes from "./routes/recurringExpenses.js";
import registerBudgetsRoutes from "./routes/budgets.js";
import registerExchangeRateRoutes, { fetchRates } from "./routes/exchangeRate.js";
import registerOcioRoutes from "./routes/ocio.js";
import registerCatalogRoutes from "./routes/catalog.js";
import registerGoogleRoutes from "./routes/google.js";
import registerKoreaderRoutes from "./routes/koreader.js";
import registerGalleryRoutes from "./routes/gallery.js";
import registerDropboxRoutes from "./routes/dropbox.js";
import { koreaderDropbox } from "./services/dropbox/index.js";
import { google } from "./services/google/index.js";
import registerOutingsRoutes from "./routes/outings.js";
import registerProjectsRoutes from "./routes/projects.js";
import registerCertificatesRoutes from "./routes/certificates.js";
import registerExportRoutes from "./routes/export.js";
import registerIncomesRoutes from "./routes/incomes.js";
import registerSavingsGoalsRoutes from "./routes/savingsGoals.js";
import registerRecurringIncomesRoutes from "./routes/recurringIncomes.js";
import registerAccountsRoutes from "./routes/accounts.js";
import registerDebtsRoutes from "./routes/debts.js";
import registerMarketRoutes, { prefetchMarket } from "./routes/market.js";

seedExerciseLibrary();
startDailyBackups();
generateDueRecurringExpenses();
generateDueRecurringIncomes();
// Las recurrentes en USD necesitan una cotización: la pedimos y volvemos a generar.
fetchRates()
  .then(() => {
    generateDueRecurringExpenses();
    generateDueRecurringIncomes();
  })
  .catch(() => {});
prefetchMarket();
startInstagramSync();
google().start();
koreaderDropbox().start();

const app = express();
app.use(securityHeaders);
app.use(requestGuard());
// CORS solo para el front de desarrollo (Vite); la app y el widget se sirven desde el mismo origen.
app.use(cors({ origin: DEV_ORIGINS }));
app.use(express.json({ limit: "1mb" }));
app.use(basicAuth);
app.use("/photos", express.static(photosDir));
app.use("/certificates", express.static(certificatesDir));
// Portadas y galería: archivos que no cambian (el nombre incluye el id), se pueden cachear fuerte.
app.use("/covers", express.static(coversDir, { maxAge: "30d", immutable: true }));
app.use("/artworks", express.static(artworksDir, { maxAge: "30d" }));

registerWeightsRoutes(app);
registerSettingsRoutes(app);
registerPlansRoutes(app);
registerFisicoRoutes(app);
registerExerciseLogsRoutes(app);
registerProgressPhotosRoutes(app);
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = join(__dirname, "..", "..", "web", "dist");
if (existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get(/^(?!\/api|\/photos|\/certificates|\/covers|\/artworks).*/, (req, res) => {
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
  console.error(err);
  res.status(500).json({ error: err.message || "internal_error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[server] Físico API escuchando en http://localhost:${PORT}`);
});

process.on("exit", () => db.close());
