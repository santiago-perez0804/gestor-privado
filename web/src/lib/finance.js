// Cálculos de ingresos, ahorro y comparaciones entre períodos de tarjeta.
import { getBillingMonth, billingMonthAdd, billingMonthDiff, monthlyTotal, monthlyTotalByCategory } from "./billing.js";

export const INCOME_CATEGORIES = [
  { id: "sueldo", label: "Sueldo" },
  { id: "freelance", label: "Freelance" },
  { id: "extra", label: "Extra / bono" },
  { id: "inversion", label: "Inversiones" },
  { id: "otros", label: "Otros" },
];

export function incomeCategoryLabel(id) {
  return INCOME_CATEGORIES.find((c) => c.id === id)?.label ?? "Otros";
}

/** Inflación mensual por defecto si no hay dato: INDEC agosto 2026 (1,7%). */
export const DEFAULT_INFLATION_PCT = 1.7;
/** Valor manual (si lo fijaste en Análisis). Sin él se usa el último dato del INDEC que guarda el server. */
export const INFLATION_SETTING_KEY = "inflation_monthly_pct";
export const INFLATION_AUTO_KEY = "inflation_auto_pct";
export const INFLATION_AUTO_MONTH_KEY = "inflation_auto_month";

export function inflationFromSettings(settings) {
  const manual = parseFloat(settings?.[INFLATION_SETTING_KEY]);
  if (Number.isFinite(manual) && manual >= 0) return manual;
  const auto = parseFloat(settings?.[INFLATION_AUTO_KEY]);
  return Number.isFinite(auto) && auto >= 0 ? auto : DEFAULT_INFLATION_PCT;
}

/** De dónde sale la inflación usada: "manual" | "indec" | "default". */
export function inflationSource(settings) {
  if (Number.isFinite(parseFloat(settings?.[INFLATION_SETTING_KEY]))) return "manual";
  return Number.isFinite(parseFloat(settings?.[INFLATION_AUTO_KEY])) ? "indec" : "default";
}

/**
 * Presupuestos con arrastre: si `rollover` está activo, lo que sobró (o se pasó) del período
 * anterior se suma al tope de este. Solo se arrastra un período, y el saldo negativo se limita
 * a un tope entero para que un mes malo no deje el presupuesto en cero para siempre.
 * @returns {Array<{category, monthlyLimit, rollover, carry, limit}>}
 */
export function effectiveBudgets(budgets, expenses, bm) {
  const prev = monthlyTotalByCategory(expenses, billingMonthAdd(bm, -1));
  return budgets.map((b) => {
    const carry = b.rollover ? Math.max(-b.monthlyLimit, b.monthlyLimit - (prev[b.category] || 0)) : 0;
    return { ...b, carry, limit: Math.max(0, b.monthlyLimit + carry) };
  });
}

/** Pasa un monto a pesos: los USD se valúan con `usdRate` (si no hay cotización, quedan afuera → 0). */
export function toArs(amount, currencyCode, usdRate) {
  if (currencyCode !== "USD") return amount;
  return usdRate ? amount * usdRate : 0;
}

/** Meta de no gasto: tope de gasto por período de tarjeta. Default $1.000.000, editable. */
export const DEFAULT_SPENDING_LIMIT = 1_000_000;
export const SPENDING_LIMIT_SETTING_KEY = "spending_limit_ars";

export function spendingLimitFromSettings(settings) {
  const v = parseFloat(settings?.[SPENDING_LIMIT_SETTING_KEY]);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_SPENDING_LIMIT;
}

/**
 * Estado de la meta de no gasto. `pace` compara lo gastado con lo "esperable" a esta altura
 * del período (tope × días transcurridos / días totales).
 */
export function spendingLimitStatus(spent, limit, progress) {
  const ratio = spent / limit;
  const remaining = limit - spent;
  const daysLeftIncludingToday = progress.daysLeft + 1;
  const perDay = remaining > 0 ? remaining / daysLeftIncludingToday : 0;
  const expected = limit * progress.ratio;
  let status = "good";
  if (ratio > 1) status = "over";
  else if (spent > expected * 1.1) status = "ahead";
  return { ratio, remaining, perDay, expected, status };
}

// Clasificación para la regla 50/30/20.
const NEEDS = new Set(["comida", "transporte", "servicios", "salud", "hogar"]);
export const isNeed = (category) => NEEDS.has(category);

export function monthlyIncome(incomes, bm) {
  return incomes.filter((i) => billingMonthDiff(getBillingMonth(i.date), bm) === 0).reduce((s, i) => s + i.amount, 0);
}

/** Lleva un monto de hace `monthsAgo` períodos a pesos de hoy. */
export function toTodayPesos(value, monthsAgo, inflationPct) {
  return value * Math.pow(1 + inflationPct / 100, Math.max(0, monthsAgo));
}

/** Últimos `n` períodos (el más viejo primero) con ingresos, gastos, ahorro y tasa. */
export function monthlySeries(expenses, incomes, currentBM, n = 6, { inflationPct = 0, real = false } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const monthsAgo = n - 1 - i;
    const bm = billingMonthAdd(currentBM, -monthsAgo);
    const k = real ? toTodayPesos(1, monthsAgo, inflationPct) : 1;
    const spent = monthlyTotal(expenses, bm) * k;
    const income = monthlyIncome(incomes, bm) * k;
    const saved = income - spent;
    return { billingMonth: bm, monthsAgo, spent, income, saved, rate: income > 0 ? saved / income : null };
  });
}

/** Necesidades vs deseos del período, según categoría. */
export function needsWants(totalsByCategory) {
  let needs = 0;
  let wants = 0;
  for (const [cat, amount] of Object.entries(totalsByCategory)) {
    if (isNeed(cat)) needs += amount;
    else wants += amount;
  }
  return { needs, wants };
}

/** Períodos anteriores (hasta `months`) con gastos cargados: evita promediar meses previos a usar la app. */
export function previousPeriodsWithData(expenses, currentBM, months = 3) {
  const out = [];
  for (let i = 1; i <= months; i++) {
    const bm = billingMonthAdd(currentBM, -i);
    if (monthlyTotal(expenses, bm) > 0) out.push({ bm, monthsAgo: i });
  }
  return out;
}

/**
 * Cada categoría del período actual contra su promedio de los períodos anteriores con datos
 * (hasta `months`), llevados a pesos de hoy. `average` es null si no hay historial.
 */
export function categoryVsAverage(expenses, currentBM, months = 3, inflationPct = 0) {
  const current = monthlyTotalByCategory(expenses, currentBM);
  const history = previousPeriodsWithData(expenses, currentBM, months);
  const sums = {};
  for (const { bm, monthsAgo } of history) {
    const totals = monthlyTotalByCategory(expenses, bm);
    for (const [cat, v] of Object.entries(totals)) sums[cat] = (sums[cat] || 0) + toTodayPesos(v, monthsAgo, inflationPct);
  }
  const cats = new Set([...Object.keys(current), ...Object.keys(sums)]);
  return [...cats]
    .map((cat) => {
      const avg = history.length ? (sums[cat] || 0) / history.length : null;
      const now = current[cat] || 0;
      return { category: cat, current: now, average: avg, delta: avg > 0 ? (now - avg) / avg : null, historyMonths: history.length };
    })
    .sort((a, b) => b.current - a.current);
}

/** Gastado hasta el día N del período (para comparar el ritmo contra el período anterior). */
export function spentUntilDay(expenses, bm, dayNumber, periodStart) {
  const limit = new Date(periodStart);
  limit.setDate(limit.getDate() + dayNumber - 1);
  const pad = (n) => String(n).padStart(2, "0");
  const limitStr = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`;
  // Solo compras hechas dentro del período (las cuotas viejas ya estaban comprometidas desde el día 1).
  return expenses
    .filter((e) => billingMonthDiff(getBillingMonth(e.date), bm) === 0 && e.date <= limitStr)
    .reduce((s, e) => s + e.amount / (e.installments || 1), 0);
}
