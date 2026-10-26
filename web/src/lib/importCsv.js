// Importación de movimientos desde un CSV (resumen de tarjeta o export del home banking).
// Cada banco exporta distinto: detectamos separador, columnas y formatos argentinos
// ("1.234,56", "12/10/2026"), y el usuario puede corregir el mapeo de columnas.
import { addMonths } from "./installments.js";
import { guessCategory } from "./expenseCategories.js";
import { guessMerchantType } from "./merchants.js";

/** Parser CSV mínimo con comillas ("a;b" dentro de un campo) y separador detectado. */
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const delimiter = [";", "\t", ","].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** "1.234,56" → 1234.56 · "-1,234.56" → -1234.56 · "$ 1500" → 1500 */
export function parseArAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d,.-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma > -1) s = s.replace(/,/g, "");
  else if (lastDot > -1 && s.length - lastDot - 1 === 3 && s.split(".").length > 1 && lastComma === -1) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

/** dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, "12-Oct-26" → "YYYY-MM-DD" */
export function parseDate(raw) {
  const s = String(raw || "").trim().toLowerCase();
  const pad = (n) => String(n).padStart(2, "0");
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  m = s.match(/^(\d{1,2})[-\s/]([a-z]{3})[a-z]*[-\s/](\d{2,4})/);
  if (m && MONTHS[m[2]]) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
  }
  return null;
}

/** "C.03/06", "Cuota 3 de 6", "3/6" → { k: 3, n: 6 } */
export function parseInstallment(text) {
  const m = String(text || "").match(/(?:c(?:uota)?\.?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
  if (!m) return null;
  const k = parseInt(m[1], 10);
  const n = parseInt(m[2], 10);
  return n >= 2 && n <= 48 && k >= 1 && k <= n ? { k, n } : null;
}

const HEADER_HINTS = {
  date: /fecha|date|d[ií]a/i,
  title: /descrip|detalle|concepto|comercio|establec|movimiento|referencia/i,
  amount: /importe|monto|pesos|\$|ars|d[eé]bito|cargo|amount/i,
  usd: /d[oó]lar|usd|u\$s/i,
  installment: /cuota/i,
};

/** Adivina qué columna es cada cosa mirando el encabezado y, si no, el contenido. */
export function guessMapping(rows) {
  const headerIdx = rows.findIndex((r) => r.some((c) => HEADER_HINTS.date.test(c)) && r.some((c) => HEADER_HINTS.title.test(c) || HEADER_HINTS.amount.test(c)));
  const header = headerIdx >= 0 ? rows[headerIdx] : null;
  const sample = rows.slice(headerIdx + 1, headerIdx + 15);
  const cols = Math.max(...rows.map((r) => r.length));
  const map = { headerRow: headerIdx, date: -1, title: -1, amount: -1, usd: -1, installment: -1 };
  if (header) {
    header.forEach((h, i) => {
      if (map.date < 0 && HEADER_HINTS.date.test(h)) map.date = i;
      else if (map.installment < 0 && HEADER_HINTS.installment.test(h)) map.installment = i;
      else if (map.usd < 0 && HEADER_HINTS.usd.test(h)) map.usd = i;
      else if (map.title < 0 && HEADER_HINTS.title.test(h)) map.title = i;
      else if (map.amount < 0 && HEADER_HINTS.amount.test(h)) map.amount = i;
    });
  }
  // Por contenido: la primera columna con fechas, la de texto más largo, la última con montos.
  for (let i = 0; i < cols; i++) {
    const vals = sample.map((r) => r[i]).filter(Boolean);
    if (!vals.length) continue;
    if (map.date < 0 && vals.every((v) => parseDate(v))) map.date = i;
  }
  if (map.title < 0) {
    let best = -1;
    let bestLen = 0;
    for (let i = 0; i < cols; i++) {
      if (i === map.date) continue;
      const avg = sample.reduce((s, r) => s + (parseAmount0(r[i]) == null ? (r[i] || "").length : 0), 0) / (sample.length || 1);
      if (avg > bestLen) [best, bestLen] = [i, avg];
    }
    map.title = best;
  }
  if (map.amount < 0) {
    for (let i = cols - 1; i >= 0; i--) {
      if ([map.date, map.title, map.usd, map.installment].includes(i)) continue;
      if (sample.filter((r) => parseAmount0(r[i]) != null).length >= sample.length / 2) {
        map.amount = i;
        break;
      }
    }
  }
  return map;
}

const parseAmount0 = (v) => (v && /\d/.test(v) && !/[a-z]{3,}/i.test(v) ? parseArAmount(v) : null);

/**
 * Convierte filas en gastos listos para cargar. Las cuotas k/n del resumen se transforman en la
 * compra original (fecha k-1 meses antes, monto total = cuota × n), que es como las guarda la app.
 * Los créditos/pagos (montos negativos o "su pago") se descartan.
 */
export function rowsToExpenses(rows, map, { usdRate = null, paymentMethod = "credito" } = {}) {
  const out = [];
  rows.slice(map.headerRow + 1).forEach((r, idx) => {
    const date = parseDate(r[map.date]);
    const rawTitle = (r[map.title] || "").replace(/\s+/g, " ").trim();
    const ars = map.amount >= 0 ? parseArAmount(r[map.amount]) : null;
    const usd = map.usd >= 0 ? parseArAmount(r[map.usd]) : null;
    if (!date || !rawTitle) return;
    if (/su pago|pago recibido|bonificaci|devoluci|reintegro/i.test(rawTitle)) return;
    const isUsd = !ars && usd > 0;
    const value = isUsd ? usd : ars;
    if (!value || value <= 0) return;
    const inst = parseInstallment(map.installment >= 0 ? r[map.installment] : rawTitle);
    const title = rawTitle.replace(/\s*(?:c(?:uota)?\.?\s*)?\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/i, "").trim() || rawTitle;
    const n = inst?.n ?? 1;
    const perInstallmentArs = isUsd ? (usdRate ? value * usdRate : null) : value;
    if (perInstallmentArs == null) return;
    out.push({
      key: idx,
      title: title[0].toUpperCase() + title.slice(1).toLowerCase(),
      date: inst ? addMonths(date, -(inst.k - 1)) : date,
      statementDate: date,
      installments: n,
      installmentNumber: inst?.k ?? 1,
      amount: perInstallmentArs * n,
      currency: isUsd ? "USD" : "ARS",
      originalAmount: isUsd ? value * n : perInstallmentArs * n,
      exchangeRate: isUsd ? usdRate : null,
      category: guessCategory(title),
      merchantType: guessMerchantType(title),
      paymentMethod,
    });
  });
  return out;
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** ¿Ya existe en la app? Mismo monto (±1%) y fecha cercana (±3 días), o mismo nombre con mismas cuotas. */
export function findDuplicate(item, expenses) {
  const t = new Date(item.date + "T00:00:00").getTime();
  return (
    expenses.find((e) => {
      const close = Math.abs(new Date(e.date + "T00:00:00").getTime() - t) <= 3 * 86_400_000;
      const sameAmount = Math.abs(e.amount - item.amount) <= Math.max(1, item.amount * 0.01);
      const sameName = norm(e.title).slice(0, 8) === norm(item.title).slice(0, 8);
      return close && (sameAmount || (sameName && (e.installments || 1) === item.installments));
    }) ?? null
  );
}
