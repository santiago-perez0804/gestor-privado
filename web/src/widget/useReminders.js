import { useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { getBillingMonth, monthlyTotal, monthlyTotalByCategory, billingPeriodProgress, calendarDateForBillingMonth, billingMonthAdd } from "../lib/billing.js";
import { categoryLabel } from "../lib/expenseCategories.js";
import { currency, todayDateInputValue } from "../lib/format.js";
import { occurrencesOf } from "../lib/installments.js";
import { effectiveBudgets, spendingLimitFromSettings, spendingLimitStatus } from "../lib/finance.js";
import { daysSince } from "./panels/PanelShell.jsx";

const FIRST_CHECK_MS = 8000;
const CHECK_EVERY_MS = 3 * 60 * 1000;

/** Cada aviso se muestra como mucho una vez por día. */
function alreadyShown(key) {
  try {
    return localStorage.getItem(`frog-reminder:${key}`) === todayDateInputValue();
  } catch {
    return false;
  }
}

function markShown(key) {
  try {
    localStorage.setItem(`frog-reminder:${key}`, todayDateInputValue());
  } catch {
    /* sin storage: puede repetirse, no pasa nada */
  }
}

async function collect() {
  const today = todayDateInputValue();
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const [weights, logs, expenses, budgets, outings, media, incomes, recurring, settings] = await Promise.all([
    api.getWeights(),
    api.getSessions().catch(() => []),
    api.getExpenses(),
    api.getBudgets(),
    api.getOutings(),
    api.getLibrary().catch(() => []),
    api.getIncomes(),
    api.getRecurringExpenses().catch(() => []),
    api.getSettings().catch(() => ({})),
  ]);
  const reminders = [];

  const weighedToday = weights.some((w) => w.recordedAt.startsWith(today));
  if (new Date().getHours() >= 10 && !weighedToday) {
    reminders.push({ key: "peso", text: "¿Te pesaste hoy? Todavía no registraste tu peso.", action: "fisico" });
  }

  // Entrenos terminados (el más reciente primero).
  const lastLog = logs[0];
  const ago = lastLog ? daysSince(lastLog.startedAt) : null;
  if (ago != null && ago >= 3) {
    reminders.push({ key: "entreno", text: `Hace ${ago} días que no entrenás. ¡Las pesas no se levantan solas!`, action: "fisico" });
  }

  const byCategory = monthlyTotalByCategory(expenses, getBillingMonth(today));
  let budgetsOver = 0;
  for (const b of effectiveBudgets(budgets, expenses, getBillingMonth(today))) {
    const ratio = b.limit > 0 ? (byCategory[b.category] || 0) / b.limit : 1;
    if (ratio >= 1) {
      budgetsOver += 1;
      reminders.push({ key: `budget-over-${b.category}`, text: `Te pasaste del presupuesto de ${categoryLabel(b.category)}. Uh…`, action: "gastos" });
    } else if (ratio >= 0.85) {
      reminders.push({
        key: `budget-near-${b.category}`,
        text: `Ojo: ya usaste el ${Math.round(ratio * 100)}% del presupuesto de ${categoryLabel(b.category)}.`,
        action: "gastos",
      });
    }
  }

  // Suscripciones / pagos fijos que se cobran mañana.
  const bm = getBillingMonth(today);
  for (const r of recurring) {
    if (!r.active) continue;
    const due = [bm, billingMonthAdd(bm, 1)].map((p) => calendarDateForBillingMonth(p, r.dayOfMonth)).find((d) => d === tomorrow);
    if (!due) continue;
    const amount = r.currency === "USD" ? `US$${r.amount}` : currency.format(r.amount);
    reminders.push({ key: `recurrente-${r.id}-${due}`, text: `Mañana se cobra ${r.title} (${amount}). ¿La seguís usando?`, action: "gastos" });
  }

  // Cierre del período: resumen a 2 días del cierre.
  const progress = billingPeriodProgress(bm, today);
  if (progress.daysLeft === 2) {
    reminders.push({
      key: `cierre-${bm.year}-${bm.month}`,
      text: `En 2 días cierra la tarjeta. Llevás ${currency.format(monthlyTotal(expenses, bm))} este período.`,
      action: "gastos",
    });
  }

  // Meta de no gasto: aviso al pasar el 80% y al pasarse.
  const limitStatus = spendingLimitStatus(monthlyTotal(expenses, bm), spendingLimitFromSettings(settings), progress);
  if (limitStatus.status === "over") {
    reminders.push({ key: `tope-over-${bm.year}-${bm.month}`, text: "Te pasaste de la meta de no gasto del período. ¡A frenar un poco!", action: "gastos" });
  } else if (limitStatus.ratio >= 0.8) {
    reminders.push({
      key: `tope-80-${bm.year}-${bm.month}`,
      text: `Ya usaste el ${Math.round(limitStatus.ratio * 100)}% de tu meta de no gasto. Quedan ${currency.format(limitStatus.perDay)} por día.`,
      action: "gastos",
    });
  }

  // Cuotas que se acreditan hoy (la 1 es la compra misma, así que avisamos desde la 2).
  for (const e of expenses) {
    if ((e.installments || 1) < 2) continue;
    const occ = occurrencesOf(e, today).find((o) => o.date === today && o.k >= 2);
    if (!occ) continue;
    reminders.push(
      occ.k === occ.n
        ? { key: `cuota-${e.id}-${occ.k}`, text: `¡Última cuota de ${e.title}! Desde el mes que viene se liberan ${currency.format(occ.amount)}.`, action: "gastos" }
        : { key: `cuota-${e.id}-${occ.k}`, text: `Hoy se suma la cuota ${occ.k}/${occ.n} de ${e.title} (${currency.format(occ.amount)}).`, action: "gastos" }
    );
  }

  for (const o of outings) {
    if (o.status !== "confirmed" && o.status !== "tentative") continue;
    const at = o.startTime ? ` a las ${o.startTime}` : "";
    if (o.date === today) reminders.push({ key: `outing-${o.id}`, text: `¡Hoy tenés: ${o.title}${at}!`, action: "ocio" });
    else if (o.date === tomorrow) reminders.push({ key: `outing-${o.id}`, text: `Mañana tenés: ${o.title}${at}.`, action: "ocio" });
  }

  // Hábitos: qué tan bien venís cuidándote. Alimenta la salud del sapo.
  let habitScore = 50;
  if (ago != null) habitScore += ago <= 1 ? 25 : ago <= 3 ? 12 : ago > 7 ? -15 : 0;
  if (weights.some((w) => daysSince(w.recordedAt) <= 3)) habitScore += 15;
  habitScore -= budgetsOver * 12;
  if (budgets.length && !budgetsOver) habitScore += 10;
  habitScore = Math.max(0, Math.min(100, habitScore));

  const recordCount = weights.length + logs.length + expenses.length + outings.length + media.length + incomes.length;
  return { reminders, habitScore, recordCount };
}

/**
 * Consulta la API periódicamente. `onReminder` recibe cada aviso nuevo del día y
 * `onHabits` el puntaje de hábitos y la cantidad total de registros cargados.
 */
export function useReminders({ onReminder, onHabits, enabled = true }) {
  const cbs = useRef({ onReminder, onHabits });
  cbs.current = { onReminder, onHabits };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function check() {
      try {
        const { reminders, habitScore, recordCount } = await collect();
        if (cancelled) return;
        cbs.current.onHabits({ habitScore, recordCount });
        for (const r of reminders) {
          if (alreadyShown(r.key)) continue;
          markShown(r.key);
          cbs.current.onReminder({ ...r, actionLabel: "Ver resumen" });
        }
      } catch {
        /* server caído: se reintenta en el próximo ciclo */
      }
    }
    const first = setTimeout(check, FIRST_CHECK_MS);
    const interval = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [enabled]);
}
