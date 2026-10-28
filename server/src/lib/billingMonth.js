/**
 * Período de la tarjeta del lado del server (generación de gastos e ingresos recurrentes). El cálculo
 * es el mismo que usa la web (shared/finanzas/period.js); acá solo se lee la configuración de settings:
 * el día de cierre por defecto y los cierres puestos a mano por mes.
 */
import { db } from "../db/index.js";
import { DEFAULT_CUTOFF_DAY, billingMonthOf, calendarDateIn, periodConfig } from "../../../shared/finanzas/period.js";

export { DEFAULT_CUTOFF_DAY };
export const CUTOFF_SETTING_KEY = "billing_cutoff_day";
export const CLOSINGS_SETTING_KEY = "billing_period_closings";

const setting = async (key) => (await db.prepare("SELECT value FROM settings WHERE key = ?").get(key))?.value;

export async function cutoffDay() {
  return periodConfig({ cutoffDay: await setting(CUTOFF_SETTING_KEY) }).cutoffDay;
}

/** Configuración vigente del período (se lee una vez y se pasa a los cálculos). */
export async function periodCfg() {
  let closings = {};
  try {
    closings = JSON.parse((await setting(CLOSINGS_SETTING_KEY)) || "{}");
  } catch {
    closings = {};
  }
  return periodConfig({ cutoffDay: await setting(CUTOFF_SETTING_KEY), closings });
}

/** Mes de facturación de una fecha con la configuración `cfg` (de periodCfg) o un día de cierre. */
export function getBillingMonth(dateStr, cfg) {
  return billingMonthOf(dateStr, typeof cfg === "number" ? { cutoffDay: cfg } : cfg);
}

export function billingMonthKey({ year, month }) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function parseBillingMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return { year, month: month - 1 };
}

export function billingMonthAdd(bm, n) {
  const total = bm.year * 12 + bm.month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function billingMonthDiff(a, b) {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** Inverso de getBillingMonth: dado un mes de facturación y un día del mes,
 * devuelve la fecha calendario YYYY-MM-DD que caería en ese mes de facturación. */
export function calendarDateForBillingMonth(bm, dayOfMonth, cfg) {
  return calendarDateIn(bm, dayOfMonth, cfg);
}

export function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
