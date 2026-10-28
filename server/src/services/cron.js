// Tareas programadas en la nube (Vercel Cron, una vez por día) y la puesta al día al abrir la app.
// En el server local no hacen falta: index.js las corre al arrancar y con temporizadores.
import { db } from "../db/index.js";
import { generateDueRecurringExpenses, generateDueRecurringIncomes } from "./recurringExpenses.js";
import { backupNow } from "./backup.js";
import { ensureBuckets } from "./storage/index.js";
import { syncInstagramProjects } from "./instagramSync.js";
import { google } from "./google/index.js";
import { koreaderDropbox } from "./dropbox/index.js";
import { fetchRates } from "../routes/exchangeRate.js";
import { todayDateInputValue } from "../lib/billingMonth.js";

/** Todo lo diario. Cada paso es independiente: si uno falla, los demás siguen. */
export async function runDaily() {
  const results = {};
  const step = async (name, fn) => {
    try {
      const r = await fn();
      results[name] = r === undefined ? "ok" : r;
    } catch (err) {
      results[name] = `error: ${err.message}`;
    }
  };
  await step("buckets", async () => (await ensureBuckets()).length ? "creados" : "ok");
  await step("cotizaciones", async () => void (await fetchRates()));
  await step("recurrentes", async () => {
    await generateDueRecurringExpenses();
    await generateDueRecurringIncomes();
  });
  await step("backup", async () => (await backupNow()) ?? "ya estaba la de hoy");
  await step("google", async () => ((await google().status()).connected ? google().sync() : "sin conectar"));
  await step("kindle", async () => ((await koreaderDropbox().status()).connected ? koreaderDropbox().sync() : "sin conectar"));
  await step("instagram", () => syncInstagramProjects());
  await db.prepare("INSERT INTO settings (key, value) VALUES ('cron.lastDailyRun', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify({ at: new Date().toISOString(), results }));
  return results;
}

let caughtUpOn = null;
/**
 * Al primer pedido del día (por instancia): genera los gastos e ingresos fijos que vencieron, por si
 * el cron todavía no corrió. Es idempotente y barato.
 */
export async function catchUpToday() {
  const today = todayDateInputValue();
  if (caughtUpOn === today) return;
  caughtUpOn = today;
  try {
    await generateDueRecurringExpenses();
    await generateDueRecurringIncomes();
  } catch (err) {
    caughtUpOn = null;
    console.warn("[cron] no se pudieron generar los fijos:", err.message);
  }
}
