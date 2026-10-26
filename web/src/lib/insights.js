// Motor de tips: mira tus gastos, ingresos, cuotas y metas y arma consejos concretos.
// Fundamentos: regla 50/30/20, fondo de emergencia de 3–6 meses de gastos esenciales y
// la comparación cuotas vs inflación (si el recargo es menor que la inflación, la cuota se licúa).
import {
  getBillingMonth,
  billingMonthAdd,
  billingMonthDiff,
  billingPeriodProgress,
  monthlyTotal,
  monthlyTotalByCategory,
  MONTHS_ES,
  CUTOFF_DAY,
} from "./billing.js";
import { categoryLabel } from "./expenseCategories.js";
import { currency } from "./format.js";
import { occurrencesOf, releasesByMonth } from "./installments.js";
import {
  monthlyIncome,
  monthlySeries,
  needsWants,
  categoryVsAverage,
  spentUntilDay,
  toTodayPesos,
  previousPeriodsWithData,
  effectiveBudgets,
  toArs,
} from "./finance.js";

const TONE_ORDER = { bad: 0, warn: 1, good: 2, info: 3 };
const pct = (x) => `${Math.round(x * 100)}%`;
const money = (x) => currency.format(Math.round(x));
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function monthsBetween(fromStr, toStr) {
  const a = new Date(fromStr + "T00:00:00");
  const b = new Date(toStr + "T00:00:00");
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);
}

/**
 * `rates` (opcional) son las cotizaciones de /api/exchange-rates: con ellas las metas en USD
 * cuentan en pesos y se calcula cuánto ahorrarías pagando la tarjeta en dólares.
 * @returns {Array<{id, tone: 'good'|'info'|'warn'|'bad', icon, title, body, action?: {to, label}}>}
 */
export function buildInsights({ expenses, incomes, budgets = [], recurring = [], goals = [], inflationPct, today, rates = null }) {
  const usdRate = rates?.blue?.venta ?? null;
  const out = [];
  const bm = getBillingMonth(today);
  const prevBM = billingMonthAdd(bm, -1);
  const spent = monthlyTotal(expenses, bm);
  const income = monthlyIncome(incomes, bm);
  const lastIncome = income || monthlyIncome(incomes, prevBM);
  const totals = monthlyTotalByCategory(expenses, bm);
  const progress = billingPeriodProgress(bm, today);
  const i = inflationPct / 100;
  const inflationLabel = String(inflationPct).replace(".", ",");

  // 1. Tasa de ahorro
  if (income > 0) {
    const rate = (income - spent) / income;
    if (rate < 0)
      out.push({
        id: "savings-negative",
        tone: "bad",
        icon: "TrendingDown",
        title: "Este período gastás más de lo que entra",
        body: `Te faltan ${money(spent - income)} para cubrir los gastos. Revisá qué se puede postergar o pasar al período que viene.`,
      });
    else
      out.push({
        id: "savings-rate",
        tone: rate >= 0.2 ? "good" : rate >= 0.1 ? "info" : "warn",
        icon: "PiggyBank",
        title: `Ahorrás el ${pct(rate)} de tus ingresos`,
        body:
          rate >= 0.2
            ? `Estás por encima del 20% que sugiere la regla 50/30/20. Si lo separás apenas cobrás ("págate primero"), cuesta menos sostenerlo.`
            : `La referencia es apartar el 20% (${money(income * 0.2)} este período). Probá automatizar un aporte a una meta apenas cobrás.`,
        action: { to: "/gastos/metas", label: "Ver metas" },
      });
  } else {
    out.push({
      id: "no-income",
      tone: "info",
      icon: "Wallet",
      title: "Cargá tus ingresos",
      body: "Con tus ingresos puedo calcular cuánto ahorrás, qué parte se llevan las cuotas y si vas bien con la regla 50/30/20.",
      action: { to: "/gastos/ingresos", label: "Cargar ingreso" },
    });
  }

  // 2. Regla 50/30/20
  if (income > 0) {
    const { needs, wants } = needsWants(totals);
    const needsR = needs / income;
    const wantsR = wants / income;
    const overNeeds = needsR > 0.5;
    const overWants = wantsR > 0.3;
    out.push({
      id: "50-30-20",
      tone: overNeeds || overWants ? "warn" : "good",
      icon: "Scale",
      title: `Necesidades ${pct(needsR)} · Deseos ${pct(wantsR)}`,
      body: overNeeds
        ? `Lo esencial (comida, transporte, servicios, salud, hogar) supera el 50% del ingreso. Ahí suelen rendir más los recortes chicos y repetidos: planes de celular, seguros, compras grandes en mayorista.`
        : overWants
          ? `Los gustos pasan el 30% sugerido. No hace falta eliminarlos: poné un tope semanal y lo que sobre va a una meta.`
          : `Estás dentro de la regla 50/30/20 (máximo 50% necesidades, 30% deseos, 20% ahorro).`,
    });
  }

  // 3. Ritmo del período vs el anterior a la misma altura
  if (progress.dayNumber >= 5 && progress.daysLeft > 0) {
    const start = new Date(bm.year, bm.month - 1, CUTOFF_DAY + 1);
    const prevStart = new Date(prevBM.year, prevBM.month - 1, CUTOFF_DAY + 1);
    const now = spentUntilDay(expenses, bm, progress.dayNumber, start);
    const before = toTodayPesos(spentUntilDay(expenses, prevBM, progress.dayNumber, prevStart), 1, inflationPct);
    if (before > 0) {
      const diff = (now - before) / before;
      if (Math.abs(diff) >= 0.15)
        out.push({
          id: "pace",
          tone: diff > 0 ? "warn" : "good",
          icon: diff > 0 ? "Gauge" : "Sparkles",
          title: diff > 0 ? `Vas ${pct(diff)} arriba del período pasado` : `Vas ${pct(-diff)} abajo del período pasado`,
          body: `A esta altura (día ${progress.dayNumber}) llevás ${money(now)} en compras nuevas contra ${money(before)} el período anterior (ajustado por inflación).`,
        });
    }
  }

  // 4. Categoría disparada vs promedio de 3 períodos (en pesos de hoy). Con menos de 2 períodos
  // de historial la comparación engaña (el primer mes cargado suele estar incompleto).
  const spikes = categoryVsAverage(expenses, bm, 3, inflationPct).filter(
    (c) => c.historyMonths >= 2 && c.delta != null && c.delta > 0.3 && c.average > spent * 0.03 && c.current > spent * 0.05
  );
  if (spikes.length) {
    const s = spikes[0];
    out.push({
      id: `spike-${s.category}`,
      tone: "warn",
      icon: "TrendingUp",
      title: `${categoryLabel(s.category)}: +${pct(s.delta)} vs tu promedio`,
      body: `Este período van ${money(s.current)} contra un promedio de ${money(s.average)} en los últimos ${s.historyMonths} (ya ajustado por inflación del ${inflationLabel}% mensual).`,
      action: { to: "/gastos/analisis", label: "Comparar" },
    });
  }

  // 5. Gastos hormiga
  const threshold = Math.max(spent * 0.03, 1);
  const small = expenses.filter(
    (e) => (e.installments || 1) === 1 && billingMonthDiff(getBillingMonth(e.date), bm) === 0 && e.amount < threshold
  );
  if (small.length >= 8) {
    const sum = small.reduce((s, e) => s + e.amount, 0);
    out.push({
      id: "ants",
      tone: "info",
      icon: "Bug",
      title: `${small.length} gastos chicos suman ${money(sum)}`,
      body: `Son el ${pct(sum / (spent || 1))} del período. Sostenido, serían unos ${money(sum * 12)} al año: los "gastos hormiga" casi nunca se sienten de a uno.`,
    });
  }

  // 6. Ingreso ya comprometido en cuotas para el próximo período
  const nextBM = billingMonthAdd(bm, 1);
  const committedNext = monthlyTotal(expenses, nextBM);
  if (committedNext > 0 && lastIncome > 0) {
    const r = committedNext / lastIncome;
    out.push({
      id: "committed",
      tone: r > 0.3 ? "warn" : "info",
      icon: "CalendarClock",
      title: `${pct(r)} del próximo ingreso ya está comprometido`,
      body:
        r > 0.3
          ? `Entre cuotas ya firmadas, ${MONTHS_ES[nextBM.month]} arranca con ${money(committedNext)} gastados. Antes de sumar otra compra en cuotas, mirá cuándo se liberan las actuales.`
          : `${cap(MONTHS_ES[nextBM.month])} arranca con ${money(committedNext)} en cuotas. Estás en una zona cómoda (menos del 30%).`,
      action: { to: "/gastos/proyeccion", label: "Proyección" },
    });
  }

  // 7. Cuotas vs inflación: cuánto valen las cuotas pendientes en pesos de hoy
  if (i > 0) {
    let nominal = 0;
    let real = 0;
    for (const e of expenses) {
      if ((e.installments || 1) < 2) continue;
      for (const o of occurrencesOf(e, today)) {
        if (o.status !== "upcoming") continue;
        const m = Math.max(1, monthsBetween(today, o.date) + 1);
        nominal += o.amount;
        real += o.amount / Math.pow(1 + i, m);
      }
    }
    if (nominal > 0)
      out.push({
        id: "inflation-installments",
        tone: "info",
        icon: "Percent",
        title: `Tus cuotas pendientes valen ${money(nominal - real)} menos`,
        body: `Debés ${money(nominal)} en cuotas, que en pesos de hoy equivalen a ${money(real)} con una inflación de ${inflationLabel}% mensual. Regla práctica: las cuotas "sin interés" convienen si el recargo sobre el precio de contado (o el CFT) es menor que la inflación del plazo (~${pct(Math.pow(1 + i, 6) - 1)} en 6 meses).`,
      });
  }

  // 8. Próxima liberación de cuotas
  const releases = releasesByMonth(expenses, bm, 6);
  if (releases.length) {
    const r = releases[0];
    out.push({
      id: "release",
      tone: "good",
      icon: "Unlock",
      title: `En ${MONTHS_ES[r.billingMonth.month]} se liberan ${money(r.amount)} por mes`,
      body: `Terminan ${r.expenses.length === 1 ? `las cuotas de ${r.expenses[0].title}` : `${r.expenses.length} compras en cuotas (${r.expenses.map((e) => e.title).join(", ")})`}. Buena oportunidad para pasar ese monto a una meta de ahorro en vez de absorberlo.`,
    });
  }

  // 9. Fondo de emergencia
  // Promedio de gastos esenciales en los períodos con datos (si no hay historial, el actual).
  const history = previousPeriodsWithData(expenses, bm, 3);
  const needsPeriods = history.length ? history.map((h) => h.bm) : [bm];
  const needsAvg = needsPeriods.reduce((s, p) => s + needsWants(monthlyTotalByCategory(expenses, p)).needs, 0) / needsPeriods.length;
  if (needsAvg > 0) {
    const emergency = goals.find((g) => /emergencia|colch[oó]n|imprevisto/i.test(g.title) && !g.archived);
    if (emergency && (emergency.currency !== "USD" || usdRate)) {
      const months = toArs(emergency.saved, emergency.currency, usdRate) / needsAvg;
      out.push({
        id: "emergency",
        tone: months >= 3 ? "good" : "warn",
        icon: "ShieldCheck",
        title: `Tu fondo de emergencia cubre ${months.toFixed(1)} meses`,
        body:
          months >= 6
            ? "Ya superaste los 6 meses de gastos esenciales: lo que sigas ahorrando puede ir a metas o inversiones de más largo plazo."
            : `Lo recomendado son 3 a 6 meses de gastos esenciales: entre ${money(needsAvg * 3)} y ${money(needsAvg * 6)}. Tenelo en algo líquido que le gane a la inflación (cuenta remunerada, FCI money market).`,
        action: { to: "/gastos/metas", label: "Ver meta" },
      });
    } else if (!emergency) {
      out.push({
        id: "emergency-missing",
        tone: "info",
        icon: "ShieldCheck",
        title: "Armá un fondo de emergencia",
        body: `Con tus gastos esenciales (~${money(needsAvg)}/mes), el colchón ideal está entre ${money(needsAvg * 3)} y ${money(needsAvg * 6)}. Creá una meta que se llame "Fondo de emergencia" y te muestro cuántos meses cubre.`,
        action: { to: "/gastos/metas", label: "Crear meta" },
      });
    }
  }

  // 10. Suscripciones y gastos fijos (las de USD se valúan a dólar tarjeta)
  const cardRate = rates?.tarjeta?.venta ?? null;
  const fixed = recurring.filter((r) => r.active && (r.currency === "ARS" || cardRate));
  if (fixed.length) {
    const sum = fixed.reduce((s, r) => s + toArs(r.amount, r.currency, cardRate), 0);
    out.push({
      id: "subscriptions",
      tone: lastIncome > 0 && sum / lastIncome > 0.15 ? "warn" : "info",
      icon: "Repeat",
      title: fixed.length === 1 ? `Tu gasto fijo suma ${money(sum)}/mes` : `${fixed.length} gastos fijos suman ${money(sum)}/mes`,
      body: `${lastIncome > 0 ? `Son el ${pct(sum / lastIncome)} de tu ingreso. ` : ""}Una vez por trimestre conviene repasar suscripciones: las que no usaste en el último mes, afuera.`,
      action: { to: "/gastos/recurrentes", label: "Revisar" },
    });
  }

  // 11. Ritmo de metas con fecha
  // Ahorro promedio de los últimos períodos completos que tienen ingresos cargados.
  const series = monthlySeries(expenses, incomes, bm, 4)
    .slice(0, 3)
    .filter((m) => m.income > 0);
  const avgSaved = series.length ? series.reduce((s, m) => s + Math.max(0, m.saved), 0) / series.length : Math.max(0, income - spent);
  const pending = goals
    .filter((g) => !g.archived && g.deadline && g.saved < g.targetAmount && (g.currency === "ARS" || usdRate))
    .map((g) => {
      const monthsLeft = Math.max(1, monthsBetween(today, g.deadline));
      const missing = toArs(g.targetAmount - g.saved, g.currency, usdRate);
      return { goal: g, monthsLeft, needed: missing / monthsLeft };
    })
    .sort((a, b) => b.needed - a.needed);
  if (pending.length) {
    const p = pending[0];
    const onTrack = avgSaved >= p.needed;
    out.push({
      id: `goal-${p.goal.id}`,
      tone: onTrack ? "good" : "warn",
      icon: "Target",
      title: `${p.goal.title}: necesitás ${money(p.needed)}/mes${p.goal.currency === "USD" ? " (en pesos, al blue)" : ""}`,
      body: onTrack
        ? `Venís ahorrando ~${money(avgSaved)} por período, así que llegás a tiempo en ${p.monthsLeft} meses.`
        : `Venís ahorrando ~${money(avgSaved)} por período. Para llegar en ${p.monthsLeft} meses te faltan ${money(p.needed - avgSaved)}/mes, o mové la fecha.`,
      action: { to: "/gastos/metas", label: "Ver metas" },
    });
  }

  // 12. Presupuestos en riesgo al ritmo actual
  if (progress.ratio >= 0.25 && progress.daysLeft > 0) {
    for (const b of effectiveBudgets(budgets, expenses, bm)) {
      const now = totals[b.category] || 0;
      const projected = now / progress.ratio;
      if (now < b.limit && projected > b.limit * 1.05) {
        out.push({
          id: `budget-risk-${b.category}`,
          tone: "warn",
          icon: "AlertTriangle",
          title: `${categoryLabel(b.category)} podría pasarse del presupuesto`,
          body: `Llevás ${money(now)} de ${money(b.limit)} y faltan ${progress.daysLeft} días. A este ritmo terminarías cerca de ${money(projected)}.`,
          action: { to: "/gastos/reportes", label: "Presupuestos" },
        });
        break;
      }
    }
  }

  // 13. Compras en dólares con tarjeta: si se pagan en pesos, el banco cobra oficial + 30% de percepción.
  // Pagando esa parte del resumen con dólares propios (comprados por MEP) no hay percepción.
  const mep = rates?.bolsa?.venta;
  if (mep) {
    const usdThisPeriod = expenses.filter(
      (e) => e.currency === "USD" && e.paymentMethod !== "debito" && billingMonthDiff(getBillingMonth(e.date), bm) === 0
    );
    const paid = usdThisPeriod.reduce((s, e) => s + e.amount, 0);
    const viaMep = usdThisPeriod.reduce((s, e) => s + e.originalAmount * mep, 0);
    if (paid - viaMep > Math.max(2000, paid * 0.05)) {
      const usdTotal = usdThisPeriod.reduce((s, e) => s + e.originalAmount, 0);
      out.push({
        id: "usd-card",
        tone: "warn",
        icon: "DollarSign",
        title: `Pagá los US$${Math.round(usdTotal)} del resumen en dólares: ahorrás ~${money(paid - viaMep)}`,
        body: `En pesos te cobran dólar tarjeta (oficial + 30% de percepción): ${money(paid)}. Si comprás esos dólares por MEP (${money(mep)}) y pagás esa parte en USD, sale ${money(viaMep)}. Hacé "stop debit" del débito automático antes del vencimiento, o adherí los consumos en dólares a tu caja de ahorro en USD. Si ya pagaste en pesos, la percepción se puede pedir de vuelta a ARCA.`,
        action: { to: "/gastos/tips", label: "Ver cómo" },
      });
    }
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export const TONE_STYLE = {
  good: { fg: "var(--status-good)", bg: "color-mix(in srgb, var(--status-good) 12%, transparent)", label: "Bien" },
  info: { fg: "var(--chart-cat-1)", bg: "color-mix(in srgb, var(--chart-cat-1) 12%, transparent)", label: "Info" },
  warn: { fg: "var(--status-warning)", bg: "color-mix(in srgb, var(--status-warning) 14%, transparent)", label: "Ojo" },
  bad: { fg: "var(--status-critical)", bg: "color-mix(in srgb, var(--status-critical) 12%, transparent)", label: "Alerta" },
};
