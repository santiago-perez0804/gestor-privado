// Medidas: evolución por zona (con dirección "buena" configurable), relaciones y próxima medición.
import { addDays, daysBetween } from "./dates.js";

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** Medidas → por zona, ordenadas por fecha. */
export function byZone(measurements) {
  const out = {};
  for (const m of measurements) (out[m.zone] ||= []).push({ day: m.measuredOn, cm: m.valueCm });
  for (const z of Object.keys(out)) out[z].sort((a, b) => a.day.localeCompare(b.day));
  return out;
}

/**
 * Evolución de una zona: último valor, cambio contra el anterior y desde el primero, y veredicto según
 * la dirección: 'down' (que baje, p. ej. cintura), 'up' (que suba) o 'neutral'.
 */
export function zoneTrend(series, direction = "neutral", { flatCm = 0.25 } = {}) {
  if (!series?.length) return null;
  const latest = series.at(-1);
  const previous = series.length > 1 ? series.at(-2) : null;
  const change = previous ? r1(latest.cm - previous.cm) : null;
  const sinceFirst = series.length > 1 ? r1(latest.cm - series[0].cm) : null;
  const ref = sinceFirst ?? change;
  let verdict = "none";
  if (ref != null) {
    if (Math.abs(ref) < flatCm) verdict = "flat";
    else if (direction === "neutral") verdict = "neutral";
    else verdict = (direction === "down") === ref < 0 ? "good" : "bad";
  }
  return { latest, previous, change, sinceFirst, first: series[0], verdict };
}

/** Hombros ÷ cintura (la "V") y cintura ÷ altura (salud: < 0,5 recomendado; solo con altura). */
export function ratios(zones, heightCm = null) {
  const last = (z, i = 1) => zones[z]?.at(-i)?.cm ?? null;
  const sw = (i) => (last("hombros", i) && last("cintura", i) ? r2(last("hombros", i) / last("cintura", i)) : null);
  const waist = last("cintura");
  return {
    shouldersToWaist: sw(1),
    shouldersToWaistBefore: zones.hombros?.length > 1 && zones.cintura?.length > 1 ? sw(2) : null,
    waistToHeight: waist && heightCm > 0 ? r2(waist / heightCm) : null,
    waistToHeightOk: waist && heightCm > 0 ? waist / heightCm < 0.5 : null,
  };
}

/** Próxima vez que toca (medir o sacar fotos) a partir de la última. */
export function nextDue(lastDay, everyDays, today) {
  if (!lastDay) return { date: today, daysLeft: 0, overdue: false, never: true };
  const date = addDays(lastDay, everyDays);
  const daysLeft = daysBetween(today, date);
  return { date, daysLeft, overdue: daysLeft < 0, never: false };
}

/** Cambio de una zona entre dos fechas (el valor más cercano a cada una, sin pasarse). */
export function changeBetween(series, from, to) {
  const at = (d) => [...(series || [])].reverse().find((p) => p.day <= d)?.cm ?? null;
  const a = at(from);
  const b = at(to);
  return a != null && b != null ? r1(b - a) : null;
}
