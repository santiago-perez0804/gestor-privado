// Día de cierre de la tarjeta. Es configurable (setting "billing_cutoff_day"): se carga al iniciar
// con applyFinanceSettings y, como es un `let` exportado, todos los imports ven el valor nuevo.
export const DEFAULT_CUTOFF_DAY = 26;
export const CUTOFF_SETTING_KEY = "billing_cutoff_day";
export let CUTOFF_DAY = DEFAULT_CUTOFF_DAY;

export function setCutoffDay(day) {
  const n = parseInt(day, 10);
  CUTOFF_DAY = n >= 1 && n <= 28 ? n : DEFAULT_CUTOFF_DAY;
}
export const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const MONTHS_ES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function getBillingMonth(dateStr, cutoffDay = CUTOFF_DAY) {
  const d = new Date(dateStr + "T00:00:00");
  let year = d.getFullYear();
  let month = d.getMonth();
  if (d.getDate() > cutoffDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return { year, month };
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

export function billingPeriodRange({ year, month }) {
  const start = new Date(year, month - 1, CUTOFF_DAY + 1);
  const end = new Date(year, month, CUTOFF_DAY);
  const fmt = (d) => `${d.getDate()} ${MONTHS_ES_ABBR[d.getMonth()]}`.toLowerCase();
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

/** Progreso del período de facturación actual: del día CUTOFF_DAY+1 del mes
 * anterior al día CUTOFF_DAY (inclusive) del mes de facturación. */
export function billingPeriodProgress({ year, month }, todayStr) {
  const start = new Date(year, month - 1, CUTOFF_DAY + 1);
  const end = new Date(year, month, CUTOFF_DAY);
  const today = new Date(todayStr + "T00:00:00");
  const DAY_MS = 86400000;
  const totalDays = Math.round((end - start) / DAY_MS) + 1;
  const dayNumber = Math.min(Math.max(Math.round((today - start) / DAY_MS) + 1, 1), totalDays);
  return {
    totalDays,
    dayNumber,
    daysLeft: totalDays - dayNumber,
    ratio: dayNumber / totalDays,
  };
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
  const { year, month } = dayOfMonth > CUTOFF_DAY ? billingMonthAdd(bm, -1) : bm;
  const day = Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate());
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
