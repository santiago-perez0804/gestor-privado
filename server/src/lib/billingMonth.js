/**
 * Espejo mínimo de web/src/lib/billing.js para uso server-side (generación de
 * gastos recurrentes sin depender del navegador). Debe mantenerse sincronizado
 * con la lógica de getBillingMonth del frontend. El día de cierre sale de settings.
 */
import { db } from "../db/index.js";

export const DEFAULT_CUTOFF_DAY = 26;
export const CUTOFF_SETTING_KEY = "billing_cutoff_day";

export function cutoffDay() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(CUTOFF_SETTING_KEY);
  const n = parseInt(row?.value, 10);
  return n >= 1 && n <= 28 ? n : DEFAULT_CUTOFF_DAY;
}

export function getBillingMonth(dateStr, cutoff = cutoffDay()) {
  const d = new Date(dateStr + "T00:00:00");
  let year = d.getFullYear();
  let month = d.getMonth();
  if (d.getDate() > cutoff) {
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

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Inverso de getBillingMonth: dado un mes de facturación y un día del mes,
 * devuelve la fecha calendario YYYY-MM-DD que caería en ese mes de facturación. */
export function calendarDateForBillingMonth(bm, dayOfMonth) {
  const { year, month } = dayOfMonth > cutoffDay() ? billingMonthAdd(bm, -1) : bm;
  const day = Math.min(dayOfMonth, daysInMonth(year, month));
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
