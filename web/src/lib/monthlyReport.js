// Informe mensual: todo lo que se puede sacar de los gastos de un período de tarjeta.
// Dos bases de cálculo (se explican en la metodología del informe):
//  - "Pagado en el período": lo que entra en el resumen, con cuotas (igual que Resumen y presupuestos).
//  - "Compras del período": cada compra hecha en el período por su valor total (hábitos y comercios).
import {
  getBillingMonth,
  billingMonthAdd,
  billingMonthDiff,
  billingMonthLabel,
  billingPeriodRange,
  billingPeriodProgress,
  monthlyTotal,
  monthlyTotalByCategory,
  monthlyTotalByPaymentMethod,
  MONTHS_ES,
  MONTHS_ES_ABBR,
} from "./billing.js";
import { categoryLabel } from "./expenseCategories.js";
import { currency } from "./format.js";
import { releasesByMonth } from "./installments.js";
import { MERCHANT_TYPES, effectiveMerchantType, guessMerchantType, learnFromHistory, merchantTypeLabel, normalizeTitle } from "./merchants.js";
import { suspiciousCategory } from "./classificationGuide.js";
import { monthlyIncome, needsWants, categoryVsAverage, toTodayPesos, effectiveBudgets, previousPeriodsWithData, isNeed, toArs } from "./finance.js";

export const KIOSK_MARKUP_SETTING_KEY = "kiosk_markup_pct";
export const DEFAULT_KIOSK_MARKUP_PCT = 30;
const WEEKS_PER_MONTH = 4.33;
const TREND_PERIODS = 6;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// Un período sirve para comparar si tiene al menos 10 compras y no menos del 40% de las del período
// del informe: los primeros meses de uso suelen estar incompletos y darían subas absurdas (+800%).
const MIN_COMPARABLE_PURCHASES = 10;
const MIN_COMPARABLE_RATIO = 0.4;

export function kioskMarkupFromSettings(settings) {
  const v = parseFloat(settings?.[KIOSK_MARKUP_SETTING_KEY]);
  return Number.isFinite(v) && v >= 0 && v <= 200 ? v : DEFAULT_KIOSK_MARKUP_PCT;
}

const money = (x) => currency.format(Math.round(x));
const pct = (x) => `${Math.round(x * 100)}%`;
const sum = (list, f = (x) => x) => list.reduce((s, x) => s + f(x), 0);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sameBM = (a, b) => billingMonthDiff(a, b) === 0;
const shortLabel = (bm) => `${MONTHS_ES_ABBR[bm.month]} ${String(bm.year).slice(2)}`;

/** Compras hechas dentro del período (cada una una sola vez, por su valor total). */
export function purchasesIn(expenses, bm) {
  return expenses.filter((e) => sameBM(getBillingMonth(e.date), bm));
}

// ---------- productos a partir de la descripción ----------

const STOP = new Set(
  "de del la el los las un una unos unas y e con para por en a al etc cosas cosa varios varias algo aprox tambien mas otro otros otra no me acuerdo que q se lo le mi yo pague compre creo sin muy poco tenia hambre cu c u".split(" ")
);
const GENERIC = new Set(["comida", "compras", "compra", "super", "supermercado", "mercaderia", "verdulerias", "verduleria", "kiosco"]);
const PRODUCT_WORDS =
  /alfajor|gomita|chicle|caramelo|chocolate|golosina|red ?bull|monster|takis|doritos|papas|coca|gaseosa|agua|cerveza|leche|yogur|pan\b|fideo|arroz|huevo|maple|pollo|carne|queso|jam[oó]n|verdura|fruta|banana|tomate|galletit|bud[ií]n|chip[aá]|sanguche|factura|medialuna|helado|postre|dulce|man[ií]\b/i;

function singular(w) {
  // "alfajores" → "alfajor", pero "postres" → "postre" (no dejar dos consonantes al final).
  if (w.length > 4 && /[^aeiou]es$/.test(w) && !/[^aeiou]{2}es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && /[aeiou]s$/.test(w)) return w.slice(0, -1);
  return w;
}

/** "2 cebollas, 200gr jamón y queso rallado" → ["cebolla", "jamon", "queso rallado"] */
export function extractItems(text = "") {
  const out = [];
  for (const chunk of text.split(/,|;|\+|\/|\.|\by\b|\be\b|\bcon\b/i)) {
    const words = chunk
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\d+([.,]\d+)?\s*(gr|g|kg|ml|lt|l|cc|un|u)?\b/g, " ")
      .replace(/[^a-zñ\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    while (words.length && STOP.has(words[0])) words.shift();
    while (words.length && STOP.has(words[words.length - 1])) words.pop();
    const item = words.slice(0, 3).map(singular).join(" ");
    if (item.length > 2 && !GENERIC.has(item) && !guessMerchantType(item)) out.push(item);
  }
  return [...new Set(out)];
}

/** ¿De qué texto salen los productos? La descripción; o el título si no es un comercio y nombra productos. */
function itemSource(e) {
  if (e.description?.trim()) return e.description;
  if (!guessMerchantType(e.title) && (/,| y |\+/i.test(e.title) || PRODUCT_WORDS.test(e.title))) return e.title;
  return "";
}

const ITEM_CATEGORIES = new Set(["comida", "hogar", "salud"]);
const ITEM_MERCHANTS = new Set(["supermercado", "kiosco", "almacen", "fresco", "farmacia"]);

function topItems(purchases, limit = 10) {
  const map = new Map();
  for (const p of purchases) {
    if (!ITEM_CATEGORIES.has(p.category) && !ITEM_MERCHANTS.has(p.merchant)) continue;
    for (const item of extractItems(itemSource(p))) {
      const entry = map.get(item) || { item, count: 0, total: 0 };
      entry.count += 1;
      entry.total += p.amount;
      map.set(item, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.total - a.total).slice(0, limit);
}

// ---------- informe ----------

/**
 * @param {object} p
 * @param {Array} p.expenses todos los gastos
 * @param {{year, month}} p.bm período del informe
 * @param {string} p.today YYYY-MM-DD
 */
export function buildMonthlyReport({ expenses, incomes = [], budgets = [], recurring = [], rates = null, bm, today, inflationPct = 0, kioskMarkupPct = DEFAULT_KIOSK_MARKUP_PCT }) {
  const memory = learnFromHistory(expenses);
  const real = (value, monthsBefore) => toTodayPesos(value, monthsBefore, inflationPct);
  const prevBM = billingMonthAdd(bm, -1);
  const todayBM = getBillingMonth(today);
  const closed = billingMonthDiff(todayBM, bm) > 0;
  const progress = billingPeriodProgress(bm, today);
  const daysElapsed = closed ? progress.totalDays : Math.max(1, progress.dayNumber);
  const weeks = daysElapsed / 7;
  const firstBM = expenses.length ? expenses.map((e) => getBillingMonth(e.date)).reduce((a, b) => (billingMonthDiff(a, b) <= 0 ? a : b)) : bm;

  // Compras del período con su comercio (el elegido o el deducido).
  const withMerchant = (list) =>
    list.map((e) => {
      const m = effectiveMerchantType(e, memory);
      return { ...e, merchant: m.id, merchantInferred: m.inferred };
    });
  const purchases = withMerchant(purchasesIn(expenses, bm));
  const purchasesTotal = sum(purchases, (p) => p.amount);

  // ---- KPIs ----
  const paid = monthlyTotal(expenses, bm);
  const income = monthlyIncome(incomes, bm);
  const ownCount = purchasesIn(expenses, bm).length;
  const comparable = (p) => purchasesIn(expenses, p).length >= Math.max(MIN_COMPARABLE_PURCHASES, ownCount * MIN_COMPARABLE_RATIO);
  const prevOk = comparable(prevBM);
  const prevPaidReal = prevOk ? real(monthlyTotal(expenses, prevBM), 1) : null;
  const prevPurchasesReal = prevOk ? real(sum(purchasesIn(expenses, prevBM), (e) => e.amount), 1) : null;
  const history = previousPeriodsWithData(expenses, bm, 3).filter((h) => comparable(h.bm));
  // El promedio por categoría necesita al menos 2 períodos comparables (como los tips).
  const historyOk = history.length >= 2;
  const avgPaidReal = history.length ? sum(history, (h) => real(monthlyTotal(expenses, h.bm), h.monthsAgo)) / history.length : null;
  const delta = (now, before) => (before > 0 ? (now - before) / before : null);

  const kpis = {
    paid,
    purchasesTotal,
    purchasesCount: purchases.length,
    avgTicket: purchases.length ? purchasesTotal / purchases.length : 0,
    perDay: purchasesTotal / daysElapsed,
    income,
    saved: income - paid,
    savingsRate: income > 0 ? (income - paid) / income : null,
    prevPaidReal,
    paidVsPrev: delta(paid, prevPaidReal),
    purchasesVsPrev: delta(purchasesTotal, prevPurchasesReal),
    avgPaidReal,
    paidVsAvg: avgPaidReal ? delta(paid, avgPaidReal) : null,
    historyMonths: history.length,
    comparablePrev: prevOk,
  };

  // ---- Categorías (pagado en el período) ----
  const totals = monthlyTotalByCategory(expenses, bm);
  const prevTotals = prevOk ? monthlyTotalByCategory(expenses, prevBM) : {};
  const budgetByCat = Object.fromEntries(effectiveBudgets(budgets, expenses, bm).map((b) => [b.category, b.limit]));
  const categories = categoryVsAverage(expenses, bm, 3, inflationPct)
    .filter((c) => c.current > 0 || (c.average ?? 0) > 0)
    .map((c) => {
      const prev = prevOk ? real(prevTotals[c.category] || 0, 1) : null;
      return {
        ...c,
        average: historyOk ? c.average : null,
        delta: historyOk ? c.delta : null,
        label: categoryLabel(c.category),
        share: paid > 0 ? c.current / paid : 0,
        prev,
        vsPrev: delta(c.current, prev),
        budget: budgetByCat[c.category] ?? null,
        need: isNeed(c.category),
      };
    });
  const { needs, wants } = needsWants(totals);

  // ---- Tipos de comercio (compras del período) ----
  const merchants = [...MERCHANT_TYPES.map((m) => m.id), null]
    .map((id) => {
      const list = purchases.filter((p) => p.merchant === id);
      const total = sum(list, (p) => p.amount);
      return {
        id,
        label: id ? merchantTypeLabel(id) : "Sin indicar",
        count: list.length,
        total,
        avgTicket: list.length ? total / list.length : 0,
        share: purchasesTotal > 0 ? total / purchasesTotal : 0,
        perWeek: list.length / weeks,
        inferred: list.filter((p) => p.merchantInferred).length,
      };
    })
    .filter((m) => m.count > 0)
    .sort((a, b) => b.total - a.total);

  // Serie de los últimos períodos para un grupo de comercios, en pesos del período del informe.
  const trendFor = (ids) =>
    Array.from({ length: TREND_PERIODS }, (_, i) => {
      const monthsBefore = TREND_PERIODS - 1 - i;
      const p = billingMonthAdd(bm, -monthsBefore);
      const list = withMerchant(purchasesIn(expenses, p)).filter((x) => ids.includes(x.merchant));
      const total = sum(list, (x) => x.amount);
      return { bm: p, label: shortLabel(p), total, totalReal: real(total, monthsBefore), count: list.length, noData: monthsBefore > 0 && !comparable(p) };
    });

  // ---- Kiosco vs súper ----
  const kioskList = purchases.filter((p) => p.merchant === "kiosco");
  const superList = purchases.filter((p) => p.merchant === "supermercado");
  const kioskTotal = sum(kioskList, (p) => p.amount);
  const markup = kioskMarkupPct / 100;
  const kioskPerWeek = kioskList.length / weeks;
  const kioskAvg = kioskList.length ? kioskTotal / kioskList.length : 0;
  const targetPerWeek = kioskPerWeek >= 2 ? Math.max(1, Math.floor(kioskPerWeek / 2)) : null;
  const kioskTrend = trendFor(["kiosco"]);
  const prevKiosk = kioskTrend[TREND_PERIODS - 2];
  const kiosk = {
    total: kioskTotal,
    count: kioskList.length,
    avgTicket: kioskAvg,
    perWeek: kioskPerWeek,
    vsPrev: prevKiosk && !prevKiosk.noData ? delta(kioskTotal, prevKiosk.totalReal) : null,
    markupPct: kioskMarkupPct,
    savings: kioskTotal * (1 - 1 / (1 + markup)),
    targetPerWeek,
    fewerVisitsSavings: targetPerWeek ? (kioskPerWeek - targetPerWeek) * WEEKS_PER_MONTH * kioskAvg : 0,
    trend: kioskTrend,
    items: topItems(kioskList, 6),
    inferred: kioskList.filter((p) => p.merchantInferred).length,
    superTotal: sum(superList, (p) => p.amount),
    superCount: superList.length,
    superAvgTicket: superList.length ? sum(superList, (p) => p.amount) / superList.length : 0,
  };

  // ---- Comer afuera (Comida u Ocio, según la regla) ----
  const outList = purchases.filter((p) => p.merchant === "afuera" || p.merchant === "delivery");
  const outTotal = sum(outList, (p) => p.amount);
  const eatingOut = {
    total: outTotal,
    count: outList.length,
    share: purchasesTotal > 0 ? outTotal / purchasesTotal : 0,
    asFood: sum(outList.filter((p) => p.category === "comida"), (p) => p.amount),
    asLeisure: sum(outList.filter((p) => p.category === "ocio"), (p) => p.amount),
    delivery: sum(outList.filter((p) => p.merchant === "delivery"), (p) => p.amount),
    trend: trendFor(["afuera", "delivery"]),
  };

  // ---- Hábitos ----
  const weekday = WEEKDAYS.map((label) => ({ label, total: 0, count: 0 }));
  for (const p of purchases) {
    const d = (new Date(p.date + "T00:00:00").getDay() + 6) % 7; // lunes = 0
    weekday[d].total += p.amount;
    weekday[d].count += 1;
  }
  const weekendTotal = weekday[5].total + weekday[6].total;

  // Gastos hormiga: compras chicas de un pago que no son la compra de alimentos ni cuentas o salud.
  const antThreshold = Math.max(paid * 0.02, 1);
  const ants = purchases.filter(
    (p) => (p.installments || 1) === 1 && p.amount < antThreshold && p.merchant !== "supermercado" && p.merchant !== "fresco" && p.category !== "servicios" && p.category !== "salud"
  );
  const antsTotal = sum(ants, (p) => p.amount);

  const byTitle = new Map();
  for (const p of purchases) {
    const key = normalizeTitle(p.title) || "(sin título)";
    const entry = byTitle.get(key) || { name: p.title, count: 0, total: 0, merchant: p.merchant };
    entry.count += 1;
    entry.total += p.amount;
    byTitle.set(key, entry);
  }

  const habits = {
    weekday,
    weekendShare: purchasesTotal > 0 ? weekendTotal / purchasesTotal : 0,
    ants: { count: ants.length, total: antsTotal, threshold: antThreshold, share: purchasesTotal > 0 ? antsTotal / purchasesTotal : 0, yearly: antsTotal * 12 },
    topPlaces: [...byTitle.values()].sort((a, b) => b.total - a.total).slice(0, 6),
    topItems: topItems(purchases, 10),
    biggest: [...purchases].sort((a, b) => b.amount - a.amount).slice(0, 5),
  };

  // ---- Tarjeta, cuotas y gastos fijos ----
  const cardRate = rates?.tarjeta?.venta ?? null;
  const fixed = recurring.filter((r) => r.active && (r.currency === "ARS" || cardRate));
  const credit = {
    byMethod: monthlyTotalByPaymentMethod(expenses, bm),
    newInstallments: purchases.filter((p) => (p.installments || 1) > 1).map((p) => ({ title: p.title, amount: p.amount, installments: p.installments, per: p.amount / p.installments })),
    committed: [1, 2, 3].map((k) => {
      const next = billingMonthAdd(bm, k);
      return { bm: next, label: MONTHS_ES[next.month], total: monthlyTotal(expenses, next) };
    }),
    releases: releasesByMonth(expenses, bm, 3),
    recurringCount: fixed.length,
    recurringTotal: sum(fixed, (r) => toArs(r.amount, r.currency, cardRate)),
  };

  // ---- Calidad de los datos ----
  const n = purchases.length || 1;
  const duplicates = [];
  for (let i = 0; i < purchases.length; i++) {
    for (let j = i + 1; j < purchases.length; j++) {
      const a = purchases[i];
      const b = purchases[j];
      const days = Math.abs(new Date(a.date + "T00:00:00") - new Date(b.date + "T00:00:00")) / 86_400_000;
      if (days <= 1 && (a.installments || 1) === (b.installments || 1) && Math.abs(a.amount - b.amount) <= Math.max(2, a.amount * 0.0005)) duplicates.push([a, b]);
    }
  }
  const suspicious = purchases.map((p) => ({ expense: p, guess: suspiciousCategory(p) })).filter((s) => s.guess);
  const quality = {
    count: purchases.length,
    categorized: purchases.filter((p) => p.category && p.category !== "otros").length,
    inOthers: purchases.filter((p) => !p.category || p.category === "otros"),
    withMerchant: purchases.filter((p) => p.merchantType).length,
    inferredMerchant: purchases.filter((p) => p.merchantInferred).length,
    missingMerchant: purchases.filter((p) => !p.merchantType),
    withDescription: purchases.filter((p) => p.description?.trim()).length,
    duplicates,
    suspicious,
  };
  quality.score = purchases.length ? Math.round((100 * (quality.categorized + quality.withMerchant + quality.withDescription)) / (3 * n)) : 100;

  // ---- Presupuestos sugeridos para el próximo período ----
  const suggestedBudgets = categories
    .filter((c) => c.category !== "otros")
    .slice(0, 5)
    .map((c) => {
      const base = c.average != null ? Math.max(c.average, c.current * 0.8) : c.current;
      // Necesidades: mantener; deseos: un 10% menos que lo habitual.
      const target = Math.ceil((base * (c.need ? 1 : 0.9)) / 5000) * 5000;
      return { category: c.category, label: c.label, base, target, current: c.budget };
    })
    .filter((b) => b.target > 0);

  const report = {
    period: { bm, label: billingMonthLabel(bm), range: billingPeriodRange(bm), closed, daysElapsed, totalDays: progress.totalDays, prevLabel: MONTHS_ES[prevBM.month], firstLabel: billingMonthLabel(firstBM), historyOk },
    inflationPct,
    kpis,
    categories,
    needsWants: { needs, wants, income },
    merchants,
    kiosk,
    eatingOut,
    habits,
    credit,
    quality,
    suggestedBudgets,
    purchases: [...purchases].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
  };
  report.highlights = buildHighlights(report);
  report.recommendations = buildRecommendations(report);
  return report;
}

function buildHighlights(r) {
  const { kpis, categories, kiosk, eatingOut, period, habits } = r;
  const out = [];
  const vs = kpis.paidVsPrev != null ? ` (${kpis.paidVsPrev >= 0 ? "+" : "−"}${pct(Math.abs(kpis.paidVsPrev))} vs ${period.prevLabel}, en pesos de hoy)` : "";
  out.push({ tone: kpis.paidVsPrev > 0.1 ? "warn" : "info", text: `En el período pagaste ${money(kpis.paid)}${vs}, con ${kpis.purchasesCount} compras nuevas por ${money(kpis.purchasesTotal)}.` });
  if (kpis.savingsRate != null)
    out.push({ tone: kpis.savingsRate >= 0.2 ? "good" : kpis.savingsRate >= 0 ? "warn" : "bad", text: kpis.savingsRate >= 0 ? `Ahorraste el ${pct(kpis.savingsRate)} de tus ingresos (${money(kpis.saved)}).` : `Gastaste ${money(-kpis.saved)} más de lo que entró.` });
  const top = categories[0];
  if (top) out.push({ tone: "info", text: `${top.label} fue la categoría principal: ${money(top.current)} (${pct(top.share)} de lo pagado).` });
  const spike = categories.find((c) => c.delta != null && Math.abs(c.delta) > 0.25 && c.share > 0.05);
  if (spike) out.push({ tone: spike.delta > 0 ? "warn" : "good", text: `${spike.label} ${spike.delta > 0 ? "subió" : "bajó"} ${pct(Math.abs(spike.delta))} contra tu promedio (${money(spike.average)}).` });
  if (kiosk.count > 0)
    out.push({ tone: kiosk.perWeek >= 3 ? "warn" : "info", text: `Kiosco: ${kiosk.count} compras (${kiosk.perWeek.toFixed(1).replace(".", ",")} por semana) por ${money(kiosk.total)}. Comprando lo mismo en el súper ahorrarías ~${money(kiosk.savings)}.` });
  if (eatingOut.count > 0) out.push({ tone: eatingOut.share > 0.25 ? "warn" : "info", text: `Comer afuera: ${money(eatingOut.total)} en ${eatingOut.count} ${eatingOut.count === 1 ? "vez" : "veces"} (${pct(eatingOut.share)} de tus compras).` });
  if (habits.ants.count >= 8) out.push({ tone: "info", text: `${habits.ants.count} gastos chicos suman ${money(habits.ants.total)}: sostenido, son ${money(habits.ants.yearly)} al año.` });
  return out.slice(0, 6);
}

function buildRecommendations(r) {
  const { kpis, categories, kiosk, eatingOut, habits, credit, quality, needsWants: nw } = r;
  const out = [];
  if (kiosk.total > 0) {
    const items = kiosk.items.slice(0, 3).map((i) => i.item);
    out.push({
      title: "Pasá las compras de kiosco al súper",
      body: `Sumá a la compra del súper lo que solés comprar en el kiosco${items.length ? ` (${items.join(", ")})` : ""}. Con un sobreprecio estimado del ${kiosk.markupPct}%, ahorrás ~${money(kiosk.savings)} por mes (${money(kiosk.savings * 12)} al año).`,
      impact: kiosk.savings,
    });
  }
  if (kiosk.targetPerWeek && kiosk.fewerVisitsSavings > 0)
    out.push({
      title: `Bajá el kiosco a ${kiosk.targetPerWeek} ${kiosk.targetPerWeek === 1 ? "visita" : "visitas"} por semana`,
      body: `Hoy vas ${kiosk.perWeek.toFixed(1).replace(".", ",")} veces por semana con un ticket promedio de ${money(kiosk.avgTicket)}. Cada visita que no hacés son ~${money(kiosk.avgTicket)}: en el mes, ~${money(kiosk.fewerVisitsSavings)}.`,
      impact: kiosk.fewerVisitsSavings,
    });
  if (eatingOut.total > 0 && eatingOut.share > 0.15)
    out.push({
      title: "Poné un tope para comer afuera",
      body: `Comer afuera fue el ${pct(eatingOut.share)} de tus compras (${money(eatingOut.total)}). Un tope de ${money(Math.ceil((eatingOut.total * 0.8) / 5000) * 5000)} para el mes que viene libera ~${money(eatingOut.total * 0.2)}.`,
      impact: eatingOut.total * 0.2,
    });
  if (habits.ants.count >= 8)
    out.push({
      title: "Tope semanal para gastos chicos",
      body: `Tuviste ${habits.ants.count} gastos de menos de ${money(habits.ants.threshold)}. Un tope semanal (en efectivo o en una billetera aparte) suele recortar un 30%: ~${money(habits.ants.total * 0.3)} por mes.`,
      impact: habits.ants.total * 0.3,
    });
  for (const c of categories.filter((c) => c.delta != null && c.delta > 0.3 && c.share > 0.05 && c.category !== "otros").slice(0, 2))
    out.push({
      title: `Revisá ${c.label}: +${pct(c.delta)} contra tu promedio`,
      body: `Este período ${money(c.current)} contra ${money(c.average)} de promedio (en pesos de hoy). Volver al promedio libera ~${money(c.current - c.average)}.`,
      impact: c.current - c.average,
    });
  if (nw.income > 0 && kpis.savingsRate != null && kpis.savingsRate < 0.2)
    out.push({
      title: "Separá el ahorro apenas cobrás",
      body: `Ahorraste el ${pct(Math.max(0, kpis.savingsRate))}. Llegar al 20% sugerido (${money(nw.income * 0.2)}) implica ${money(nw.income * 0.2 - Math.max(0, kpis.saved))} más por mes: pasalo a una meta el día que cobrás.`,
      impact: nw.income * 0.2 - Math.max(0, kpis.saved),
    });
  const nextCommitted = credit.committed[0]?.total ?? 0;
  if (nw.income > 0 && nextCommitted / nw.income > 0.3)
    out.push({
      title: "Frená las cuotas nuevas",
      body: `${cap(credit.committed[0].label)} arranca con ${money(nextCommitted)} ya comprometidos en cuotas (${pct(nextCommitted / nw.income)} de tu ingreso). Antes de sumar otra, esperá a que se libere alguna.`,
      impact: null,
    });
  if (quality.score < 80 && quality.count > 0)
    out.push({
      title: "Completá los datos para un informe más preciso",
      body: `Los datos del período están completos al ${quality.score}%: hay ${quality.count - quality.withMerchant} compras sin comercio, ${quality.inOthers.length} en "Otros" o sin categoría y ${quality.count - quality.withDescription} sin descripción. Usá "Revisar el mes" antes de exportar.`,
      impact: null,
    });
  return out.sort((a, b) => (b.impact ?? -1) - (a.impact ?? -1));
}

/** Períodos que se pueden elegir: del primero con gastos al actual (los más nuevos primero, máximo 12). */
export function availablePeriods(expenses, today) {
  const current = getBillingMonth(today);
  const first = expenses.length ? expenses.map((e) => getBillingMonth(e.date)).reduce((a, b) => (billingMonthDiff(a, b) <= 0 ? a : b)) : current;
  const count = Math.min(12, Math.max(1, billingMonthDiff(current, first) + 1));
  return Array.from({ length: count }, (_, i) => billingMonthAdd(current, -i));
}

/** Período por defecto: el actual si está por cerrar (≤ 2 días), si no el último cerrado. */
export function defaultReportPeriod(today) {
  const current = getBillingMonth(today);
  return billingPeriodProgress(current, today).daysLeft <= 2 ? current : billingMonthAdd(current, -1);
}
