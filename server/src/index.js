// Primero: variables de entorno (.env) para que el resto de los módulos ya las vea.
import "./env.js";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { db, photosDir, certificatesDir } from "./db/index.js";
import { seedExerciseLibrary } from "./db/seedExerciseLibrary.js";
import { generateDueRecurringExpenses, generateDueRecurringIncomes } from "./services/recurringExpenses.js";
import { startDailyBackups } from "./services/backup.js";
import { startInstagramSync } from "./services/instagramSync.js";
import { basicAuth } from "./middleware/basicAuth.js";

import registerWeightsRoutes from "./routes/weights.js";
import registerSettingsRoutes from "./routes/settings.js";
import registerPlansRoutes from "./routes/plans.js";
import registerRoutinesRoutes from "./routes/routines.js";
import registerRoutineExercisesRoutes from "./routes/routineExercises.js";
import registerExerciseLibraryRoutes from "./routes/exerciseLibrary.js";
import registerExerciseLogsRoutes from "./routes/exerciseLogs.js";
import registerBodyMeasurementsRoutes from "./routes/bodyMeasurements.js";
import registerProgressPhotosRoutes from "./routes/progressPhotos.js";
import registerExpensesRoutes from "./routes/expenses.js";
import registerRecurringExpensesRoutes from "./routes/recurringExpenses.js";
import registerBudgetsRoutes from "./routes/budgets.js";
import registerExchangeRateRoutes, { fetchRates } from "./routes/exchangeRate.js";
import registerMediaItemsRoutes from "./routes/mediaItems.js";
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

const app = express();
app.use(cors());
app.use(express.json());
app.use(basicAuth);
app.use("/photos", express.static(photosDir));
app.use("/certificates", express.static(certificatesDir));

registerWeightsRoutes(app);
registerSettingsRoutes(app);
registerPlansRoutes(app);
registerRoutinesRoutes(app);
registerRoutineExercisesRoutes(app);
registerExerciseLibraryRoutes(app);
registerExerciseLogsRoutes(app);
registerBodyMeasurementsRoutes(app);
registerProgressPhotosRoutes(app);
registerExpensesRoutes(app);
registerRecurringExpensesRoutes(app);
registerBudgetsRoutes(app);
registerExchangeRateRoutes(app);
registerMediaItemsRoutes(app);
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
  app.get(/^(?!\/api|\/photos|\/certificates).*/, (req, res) => {
    res.sendFile(join(webDistPath, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "internal_error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[server] Físico API escuchando en http://localhost:${PORT}`);
});

process.on("exit", () => db.close());
