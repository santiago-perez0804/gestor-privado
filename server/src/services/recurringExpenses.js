import { db, nowIso } from "../db/index.js";
import {
  getBillingMonth,
  billingMonthKey,
  billingMonthAdd,
  billingMonthDiff,
  parseBillingMonthKey,
  calendarDateForBillingMonth,
  todayDateInputValue,
} from "../lib/billingMonth.js";
import { lastKnownRate } from "../routes/exchangeRate.js";

/**
 * Recorre los períodos pendientes de una plantilla (desde el último generado hasta el actual)
 * y llama a `insert(date)` por cada uno. Con `notAfter`, frena en el primer período cuya fecha
 * todavía no llegó (queda pendiente para la próxima vez). Devuelve la nueva marca de agua.
 */
function generatePending(template, todayBM, insert, notAfter = null) {
  let cursor = template.lastGeneratedBillingMonthKey
    ? billingMonthAdd(parseBillingMonthKey(template.lastGeneratedBillingMonthKey), 1)
    : todayBM;
  let lastKey = template.lastGeneratedBillingMonthKey;
  while (billingMonthDiff(todayBM, cursor) >= 0) {
    const date = calendarDateForBillingMonth(cursor, template.dayOfMonth);
    if (notAfter && date > notAfter) break;
    insert(date);
    lastKey = billingMonthKey(cursor);
    cursor = billingMonthAdd(cursor, 1);
  }
  return lastKey;
}

export function generateDueRecurringExpenses() {
  const todayBM = getBillingMonth(todayDateInputValue());
  const templates = db.prepare("SELECT * FROM recurring_expenses WHERE active = 1").all();

  const insertExpense = db.prepare(`
    INSERT INTO expenses
      (title, description, amount, currency, originalAmount, exchangeRate,
       installments, date, icon, category, recurringExpenseId, paymentMethod, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateWatermark = db.prepare(
    "UPDATE recurring_expenses SET lastGeneratedBillingMonthKey = ?, updatedAt = ? WHERE id = ?"
  );

  for (const t of templates) {
    // Suscripciones en dólares (Netflix, Spotify, ChatGPT…): el banco las cobra a dólar tarjeta.
    // Sin cotización conocida no generamos, para no cargar dólares como si fueran pesos.
    const rate = t.currency === "USD" ? lastKnownRate("tarjeta") : null;
    if (t.currency === "USD" && !rate) continue;
    const lastKey = generatePending(t, todayBM, (date) => {
      const ts = nowIso();
      insertExpense.run(
        t.title,
        t.description,
        rate ? t.amount * rate : t.amount,
        t.currency,
        t.amount,
        rate,
        date,
        t.icon,
        t.category,
        t.id,
        rate ? "credito" : null,
        ts,
        ts
      );
    });
    if (lastKey !== t.lastGeneratedBillingMonthKey) updateWatermark.run(lastKey, nowIso(), t.id);
  }
}

export function generateDueRecurringIncomes() {
  const todayBM = getBillingMonth(todayDateInputValue());
  const templates = db.prepare("SELECT * FROM recurring_incomes WHERE active = 1").all();
  const insertIncome = db.prepare(`
    INSERT INTO incomes (title, amount, currency, originalAmount, exchangeRate, category, date, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Ingreso fijo', ?, ?)
  `);
  const updateWatermark = db.prepare(
    "UPDATE recurring_incomes SET lastGeneratedBillingMonthKey = ?, updatedAt = ? WHERE id = ?"
  );
  for (const t of templates) {
    // Ingresos en dólares: se valúan al blue compra (lo que te dan si los vendés).
    const rate = t.currency === "USD" ? lastKnownRate("blue", "compra") : null;
    if (t.currency === "USD" && !rate) continue;
    // Un ingreso fijo no se anota antes de cobrarlo: si el día todavía no llegó, queda para después.
    const lastKey = generatePending(
      t,
      todayBM,
      (date) => {
        const ts = nowIso();
        insertIncome.run(t.title, rate ? t.amount * rate : t.amount, t.currency, t.amount, rate, t.category, date, ts, ts);
      },
      todayDateInputValue()
    );
    if (lastKey !== t.lastGeneratedBillingMonthKey) updateWatermark.run(lastKey, nowIso(), t.id);
  }
}
