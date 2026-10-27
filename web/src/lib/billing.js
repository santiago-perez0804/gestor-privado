// Período de la tarjeta. El cálculo vive en shared/finanzas/period.js (el server usa el mismo).
// Configurable: el día de cierre por defecto (setting "billing_cutoff_day") y, por mes, una fecha de
// cierre propia (setting "billing_period_closings": { "2026-11": "2026-11-19" }), porque los bancos
// corren el cierre. Se cargan al iniciar con applyFinanceSettings; como son `let` exportados, todos
// los imports ven el valor nuevo.
import {
  DEFAULT_CUTOFF_DAY,
  billingMonthOf,
  periodBounds,
  periodProgress,
  calendarDateIn,
  periodConfig,
} from "../../../shared/finanzas/period.js";

export { DEFAULT_CUTOFF_DAY };
export const CUTOFF_SETTING_KEY = "billing_cutoff_day";
export const CLOSINGS_SETTING_KEY = "billing_period_closings";
export let CUTOFF_DAY = DEFAULT_CUTOFF_DAY;
export let PERIOD_CLOSINGS = {};

export function setCutoffDay(day) {
  CUTOFF_DAY = periodConfig({ cutoffDay: day }).cutoffDay;
}

/** Cierres por mes (JSON del setting o un objeto). */
export function setPeriodClosings(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  }
  PERIOD_CLOSINGS = periodConfig({ closings: parsed }).closings;
}

/** Configuración vigente del período (para las funciones de shared/finanzas/period). */
export const periodCfg = () => ({ cutoffDay: CUTOFF_DAY, closings: PERIOD_CLOSINGS });
export const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const MONTHS_ES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function getBillingMonth(dateStr, cutoffDay = CUTOFF_DAY) {
  // Con otro día de cierre explícito (poco común) no se aplican los cierres a mano.
  const cfg = cutoffDay === CUTOFF_DAY ? periodCfg() : { cutoffDay };
  return billingMonthOf(dateStr, cfg);
}

export function billingMonthKey({ year, month }) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** "2026-10" → { year: 2026, month: 9 } (o null si no es válido). Inverso de billingMonthKey. */
export function parseBillingMonthKey(key) {
  const [year, m] = String(key || "").split("-").map(Number);
  return year && m >= 1 && m <= 12 ? { year, month: m - 1 } : null;
}

export function billingMonthLabel({ year, month }) {
  return `${MONTHS_ES[month]} de ${year}`;
}

/** Desde y hasta (YYYY-MM-DD, inclusive) del período. */
export const billingPeriodBounds = (bm) => periodBounds(bm, periodCfg());

/** ¿Este período tiene fechas puestas a mano? */
export const isCustomPeriod = (bm) => !!(PERIOD_CLOSINGS[billingMonthKey(bm)] || PERIOD_CLOSINGS[billingMonthKey(billingMonthAdd(bm, -1))]);

export function billingPeriodRange(bm) {
  const { start, end } = billingPeriodBounds(bm);
  const fmt = (s) => `${Number(s.slice(8, 10))} ${MONTHS_ES_ABBR[Number(s.slice(5, 7)) - 1]}`.toLowerCase();
  return `${fmt(start)} – ${fmt(end)}`;
}

export function installmentAmount(expense) {
  return expense.amount / expense.installments;
}

export function billingMonthAdd(bm, n) {
  const total = bm.year * 12 + bm.month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function billingMonthDiff(a, b) {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function expenseCoversBillingMonth(expense, billingMonth) {
  const start = getBillingMonth(expense.date);
  const offset = billingMonthDiff(billingMonth, start);
  return offset >= 0 && offset < expense.installments;
}

export function monthlyTotal(expenses, billingMonth) {
  return expenses
    .filter((e) => expenseCoversBillingMonth(e, billingMonth))
    .reduce((sum, e) => sum + installmentAmount(e), 0);
}

export function monthlyTotalByCategory(expenses, billingMonth) {
  const totals = {};
  for (const e of expenses) {
    if (!expenseCoversBillingMonth(e, billingMonth)) continue;
    const category = e.category || "otros";
    totals[category] = (totals[category] || 0) + installmentAmount(e);
  }
  return totals;
}

export function projection(expenses, currentBillingMonth, monthsAhead) {
  return Array.from({ length: monthsAhead + 1 }, (_, i) => {
    const bm = billingMonthAdd(currentBillingMonth, i);
    return { billingMonth: bm, total: monthlyTotal(expenses, bm) };
  });
}

/** Progreso del período de facturación: del día siguiente al cierre anterior hasta el cierre (inclusive). */
export function billingPeriodProgress(bm, todayStr) {
  const { totalDays, dayNumber, daysLeft, ratio } = periodProgress(bm, todayStr, periodCfg());
  return { totalDays, dayNumber, daysLeft, ratio };
}

export const PAYMENT_METHODS = [
  { id: "credito", label: "Crédito" },
  { id: "debito", label: "Débito" },
];

export function paymentMethodLabel(id) {
  return PAYMENT_METHODS.find((p) => p.id === id)?.label ?? null;
}

export function monthlyTotalByPaymentMethod(expenses, billingMonth) {
  const totals = { credito: 0, debito: 0, sin: 0 };
  for (const e of expenses) {
    if (!expenseCoversBillingMonth(e, billingMonth)) continue;
    totals[e.paymentMethod in totals ? e.paymentMethod : "sin"] += installmentAmount(e);
  }
  return totals;
}

/** Inverso de getBillingMonth: la fecha calendario (YYYY-MM-DD) del día `dayOfMonth` dentro de un período. */
export function calendarDateForBillingMonth(bm, dayOfMonth) {
  return calendarDateIn(bm, dayOfMonth, periodCfg());
}
