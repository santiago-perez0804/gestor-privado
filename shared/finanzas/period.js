// Período de la tarjeta (mes de facturación). Por defecto cierra siempre el mismo día del mes
// (cutoffDay), pero cada mes puede tener su propia fecha de cierre (closings: "2026-11" → "2026-11-19"),
// porque los bancos corren el cierre según feriados y fines de semana. El período de un mes va del
// día siguiente al cierre del mes anterior hasta su propio cierre, inclusive.
// Puro y sin dependencias: lo usan la web y el server, así los dos calculan igual.

export const DEFAULT_CUTOFF_DAY = 26;
const DAY_MS = 86_400_000;
const pad = (n) => String(n).padStart(2, "0");

export const monthKey = ({ year, month }) => `${year}-${pad(month + 1)}`;
export function addMonths({ year, month }, n) {
  const total = year * 12 + month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
const daysIn = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const toUtc = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => fromUtc(toUtc(s) + n * DAY_MS);
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** Normaliza la configuración: día de cierre válido (1–28) y cierres por mes con fecha válida. */
export function periodConfig({ cutoffDay, closings } = {}) {
  const n = parseInt(cutoffDay, 10);
  const valid = {};
  for (const [k, v] of Object.entries(closings || {})) if (/^\d{4}-\d{2}$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(v)) valid[k] = v;
  return { cutoffDay: n >= 1 && n <= 28 ? n : DEFAULT_CUTOFF_DAY, closings: valid };
}

/** Fecha de cierre (YYYY-MM-DD) del período de un mes de facturación. */
export function closingDate(bm, cfg) {
  const c = periodConfig(cfg);
  const custom = c.closings[monthKey(bm)];
  if (custom) return custom;
  return `${bm.year}-${pad(bm.month + 1)}-${pad(Math.min(c.cutoffDay, daysIn(bm.year, bm.month)))}`;
}

/** Desde y hasta (inclusive) del período de un mes de facturación. */
export function periodBounds(bm, cfg) {
  return { start: addDays(closingDate(addMonths(bm, -1), cfg), 1), end: closingDate(bm, cfg) };
}

/** A qué mes de facturación pertenece una fecha (YYYY-MM-DD). */
export function billingMonthOf(dateStr, cfg) {
  const s = String(dateStr).slice(0, 10);
  let bm = { year: Number(s.slice(0, 4)), month: Number(s.slice(5, 7)) - 1 };
  // A lo sumo hay que correrse uno o dos meses (un cierre movido puede cruzar de mes).
  for (let i = 0; i < 4 && s > closingDate(bm, cfg); i++) bm = addMonths(bm, 1);
  for (let i = 0; i < 4 && s <= closingDate(addMonths(bm, -1), cfg); i++) bm = addMonths(bm, -1);
  return bm;
}

/** Avance del período en un día dado: día N de M y cuántos faltan. */
export function periodProgress(bm, todayStr, cfg) {
  const { start, end } = periodBounds(bm, cfg);
  const totalDays = daysBetween(start, end) + 1;
  const dayNumber = Math.min(Math.max(daysBetween(start, todayStr) + 1, 1), totalDays);
  return { start, end, totalDays, dayNumber, daysLeft: totalDays - dayNumber, ratio: dayNumber / totalDays };
}

/**
 * La fecha calendario de "día N del mes" que cae dentro del período (para gastos e ingresos
 * recurrentes). Se prueba el mes anterior, el mismo y el siguiente; si el día no existe se usa el último.
 */
export function calendarDateIn(bm, dayOfMonth, cfg) {
  const { start, end } = periodBounds(bm, cfg);
  for (const offset of [-1, 0, 1]) {
    const m = addMonths(bm, offset);
    const date = `${m.year}-${pad(m.month + 1)}-${pad(Math.min(dayOfMonth, daysIn(m.year, m.month)))}`;
    if (date >= start && date <= end) return date;
  }
  // El día no cae en el período (período corto): el más cercano, el cierre.
  return end;
}

/**
 * Ajusta un período a mano: guarda el cierre del mes anterior (el día antes de `start`) y el de este
 * (`end`). Devuelve los cierres nuevos. Valida que el período tenga entre 20 y 45 días.
 */
export function withCustomPeriod(bm, { start, end }, cfg) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(end || "")) throw new Error("invalid_dates");
  const days = daysBetween(start, end) + 1;
  if (days < 20 || days > 45) throw new Error("invalid_length");
  const c = periodConfig(cfg);
  const closings = { ...c.closings, [monthKey(addMonths(bm, -1))]: addDays(start, -1), [monthKey(bm)]: end };
  // Los cierres tienen que quedar en orden con los vecinos (el anterior al anterior y el siguiente).
  const prevPrev = closingDate(addMonths(bm, -2), { ...c, closings });
  const next = closingDate(addMonths(bm, 1), { ...c, closings });
  if (!(prevPrev < closings[monthKey(addMonths(bm, -1))] && end < next)) throw new Error("overlaps_neighbor");
  return closings;
}

/** Vuelve un período al día de cierre por defecto (borra sus cierres a mano). */
export function withoutCustomPeriod(bm, cfg) {
  const { closings } = periodConfig(cfg);
  const out = { ...closings };
  delete out[monthKey(bm)];
  delete out[monthKey(addMonths(bm, -1))];
  return out;
}
