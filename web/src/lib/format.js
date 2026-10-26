import { MONTHS_ES_ABBR } from "./billing.js";

export const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_ES_ABBR[d.getMonth()]}`;
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  const date = `${d.getDate()} ${MONTHS_ES_ABBR[d.getMonth()]}`;
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function toLocalDateTimeInputValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
