// Interpreta textos cortos tipo "1500 súper", "u$s 20 spotify" o "2,5k nafta".
import { guessCategory } from "../lib/expenseCategories.js";

const USD_RE = /\b(usd|u\$s|us\$|d[oó]lar(es)?)\b|\$us/i;

/** "1.500" → 1500, "1.500,50" → 1500.5, "12,5" → 12.5, "2k" → 2000 */
function parseAmount(token) {
  const m = token.match(/^(\d+(?:[.,]\d+)*)(k|mil)?$/i);
  if (!m) return null;
  let raw = m[1];
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > -1 && raw.length - lastDot - 1 === 3 && !m[2]) {
    raw = raw.replace(/\./g, "");
  } else {
    raw = raw.replace(/,/g, "");
  }
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return m[2] ? n * 1000 : n;
}

export function parseExpenseText(text) {
  const currency = USD_RE.test(text) ? "USD" : "ARS";
  const cleaned = text.replace(USD_RE, " ").replace(/\$/g, " ");
  let amount = null;
  const words = [];
  for (const token of cleaned.split(/\s+/).filter(Boolean)) {
    const n = amount == null ? parseAmount(token) : null;
    if (n != null) amount = n;
    else words.push(token);
  }
  const rawTitle = words.join(" ").trim();
  const title = rawTitle ? rawTitle[0].toUpperCase() + rawTitle.slice(1) : "";
  return { amount, currency, title, category: guessCategory(rawTitle) };
}

export function parseWeightText(text) {
  const m = text.replace(",", ".").match(/\d+(\.\d+)?/);
  const n = m ? parseFloat(m[0]) : NaN;
  return n > 20 && n < 400 ? n : null;
}
