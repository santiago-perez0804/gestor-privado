// Server local (desarrollo y app de escritorio): abre la base, arranca las tareas periódicas y escucha.
// En la nube (Vercel) no se usa este archivo: ver api/index.js y las tareas diarias de services/cron.js.
// Primero: variables de entorno (.env) para que el resto de los módulos ya las vea.
import "./env.js";
import { openDb, db } from "./db/index.js";
import { createApp } from "./app.js";
import { seedExerciseLibrary } from "./db/seedExerciseLibrary.js";
import { generateDueRecurringExpenses, generateDueRecurringIncomes } from "./services/recurringExpenses.js";
import { startDailyBackups } from "./services/backup.js";
import { startInstagramSync } from "./services/instagramSync.js";
import { ensureBuckets } from "./services/storage/index.js";
import { fetchRates } from "./routes/exchangeRate.js";
import { prefetchMarket } from "./routes/market.js";
import { koreaderDropbox } from "./services/dropbox/index.js";
import { google } from "./services/google/index.js";

await openDb();
await ensureBuckets().catch((err) => console.warn("[storage] no se pudieron revisar los buckets:", err.message));
await seedExerciseLibrary();
startDailyBackups();
await generateDueRecurringExpenses();
await generateDueRecurringIncomes();
// Las recurrentes en USD necesitan una cotización: la pedimos y volvemos a generar.
fetchRates()
  .then(async () => {
    await generateDueRecurringExpenses();
    await generateDueRecurringIncomes();
  })
  .catch(() => {});
prefetchMarket().catch(() => {});
startInstagramSync().catch((err) => console.error("[instagram-sync]", err));
google().start().catch(() => {});
koreaderDropbox().start().catch(() => {});

const app = createApp();
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT} (base: ${db.driverKind === "postgres" ? "Supabase/Postgres" : "PGlite local"})`);
});

const shutdown = async () => {
  server.close();
  await db.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
