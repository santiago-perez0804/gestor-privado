// Cuotas: a partir de cada compra en cuotas calculamos sus cuotas individuales
// (sin guardarlas en la base), para mostrarlas en su fecha y avisar cuándo terminan.
import { getBillingMonth, billingMonthAdd, billingMonthDiff, installmentAmount } from "./billing.js";

const pad = (n) => String(n).padStart(2, "0");

/** Suma `n` meses a una fecha YYYY-MM-DD, recortando el día al largo del mes (31/01 + 1 → 28/02). */
export function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const last = new Date(year, month + 1, 0).getDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`;
}

/** Color de avance: ámbar al empezar → verde en la última cuota. */
export function progressColor(progress) {
  const hue = 32 + (145 - 32) * Math.min(1, Math.max(0, progress));
  return `hsl(${hue} 70% 42%)`;
}

export function progressSoftColor(progress) {
  const hue = 32 + (145 - 32) * Math.min(1, Math.max(0, progress));
  return `hsl(${hue} 70% 45% / 0.14)`;
}

/** Todas las cuotas de una compra: { k, n, date, amount, status, progress }. */
export function occurrencesOf(expense, todayStr) {
  const n = expense.installments || 1;
  const amount = installmentAmount(expense);
  return Array.from({ length: n }, (_, i) => {
    const date = addMonths(expense.date, i);
    return {
      k: i + 1,
      n,
      date,
      amount,
      status: date <= todayStr ? "paid" : "upcoming",
      progress: (i + 1) / n,
    };
  });
}

/** Cuotas k ≥ 2 que ya llegaron a su fecha, listas para mezclar en el historial. */
export function dueInstallmentRows(expenses, todayStr) {
  const rows = [];
  for (const exp of expenses) {
    if ((exp.installments || 1) < 2) continue;
    for (const occ of occurrencesOf(exp, todayStr)) {
      if (occ.k === 1 || occ.status !== "paid") continue;
      rows.push({ ...occ, expense: exp, key: `${exp.id}-${occ.k}` });
    }
  }
  return rows;
}

/** Compras con cuotas: cuántas van pagadas, cuánto falta y en qué período termina. */
export function installmentPlans(expenses, todayStr) {
  const currentBM = getBillingMonth(todayStr);
  return expenses
    .filter((e) => (e.installments || 1) > 1)
    .map((exp) => {
      const occ = occurrencesOf(exp, todayStr);
      const paid = occ.filter((o) => o.status === "paid").length;
      const lastBM = billingMonthAdd(getBillingMonth(exp.date), exp.installments - 1);
      const next = occ.find((o) => o.status === "upcoming") ?? null;
      return {
        expense: exp,
        n: exp.installments,
        paid,
        remaining: exp.installments - paid,
        remainingAmount: (exp.installments - paid) * installmentAmount(exp),
        installment: installmentAmount(exp),
        progress: paid / exp.installments,
        next,
        lastBM,
        monthsLeft: billingMonthDiff(lastBM, currentBM),
        done: paid >= exp.installments && billingMonthDiff(lastBM, currentBM) < 0,
      };
    })
    .sort((a, b) => a.done - b.done || a.monthsLeft - b.monthsLeft || b.installment - a.installment);
}

/**
 * Cuánto "se libera" cada período cuando terminan cuotas: para cada período futuro,
 * la suma de cuotas cuyo último período fue el anterior.
 */
export function releasesByMonth(expenses, currentBM, monthsAhead = 6) {
  const out = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const bm = billingMonthAdd(currentBM, i);
    const ending = expenses.filter((e) => {
      if ((e.installments || 1) < 2) return false;
      const lastBM = billingMonthAdd(getBillingMonth(e.date), e.installments - 1);
      return billingMonthDiff(bm, lastBM) === 1;
    });
    if (ending.length) {
      out.push({ billingMonth: bm, expenses: ending, amount: ending.reduce((s, e) => s + installmentAmount(e), 0) });
    }
  }
  return out;
}
