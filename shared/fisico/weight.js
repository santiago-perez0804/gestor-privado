// Peso: tendencia (método de The Hacker's Diet), ritmo semanal, proyección a la meta, semáforo de
// ritmo saludable, promedios por semana y aviso de posible error de tipeo.
import { addDays, daysBetween, dayRange, weekStart } from "./dates.js";

export const TREND_ALPHA = 0.1;
const r2 = (n) => Math.round(n * 100) / 100;

/** Pesadas → un valor por día (si hay varias el mismo día, el promedio), ordenadas. */
export function dailyWeights(weighIns) {
  const byDay = new Map();
  for (const w of weighIns) {
    if (!(w.kg > 0) || !w.day) continue;
    const e = byDay.get(w.day) || { sum: 0, n: 0 };
    byDay.set(w.day, { sum: e.sum + w.kg, n: e.n + 1 });
  }
  return [...byDay].map(([day, e]) => ({ day, kg: e.sum / e.n })).sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Tendencia diaria: se interpolan linealmente los días sin pesada y se aplica un promedio móvil
 * exponencial (α = 0,1 por día). Después de la última pesada, hasta `until`, se mantiene el último
 * valor (no se inventa una caída o subida).
 * @param {{ day: string, kg: number }[]} weighIns
 * @returns {{ day: string, kg: number|null, interpolated: number, trend: number }[]}
 */
export function trendSeries(weighIns, { until = null, alpha = TREND_ALPHA } = {}) {
  const daily = dailyWeights(weighIns);
  if (!daily.length) return [];
  const last = until && until > daily.at(-1).day ? until : daily.at(-1).day;
  const out = [];
  let trend = daily[0].kg;
  let i = 0;
  for (const day of dayRange(daily[0].day, last)) {
    while (i + 1 < daily.length && daily[i + 1].day <= day) i += 1;
    const cur = daily[i];
    const next = daily[i + 1];
    const value = cur.day === day ? cur.kg : next ? cur.kg + ((next.kg - cur.kg) * daysBetween(cur.day, day)) / daysBetween(cur.day, next.day) : cur.kg;
    trend = trend + alpha * (value - trend);
    out.push({ day, kg: cur.day === day ? cur.kg : null, interpolated: value, trend });
  }
  return out;
}

/** Tendencia en un día (o la última conocida antes). */
export function trendAt(series, day) {
  let found = null;
  for (const p of series) {
    if (p.day > day) break;
    found = p;
  }
  return found?.trend ?? null;
}

/**
 * Ritmo semanal: diferencia de la tendencia en los últimos 28 días ÷ 4 (kg por semana, negativo =
 * bajando) y como % del peso. Con menos de 28 días de datos usa lo que haya (partial = true).
 */
export function weeklyRate(series, today) {
  if (series.filter((p) => p.kg != null && p.day <= today).length < 2) return null; // una sola pesada: no hay ritmo
  const end = trendAt(series, today);
  const firstDay = series[0].day;
  const from = addDays(today, -28) < firstDay ? firstDay : addDays(today, -28);
  const span = daysBetween(from, today);
  if (span < 7 || end == null) return null; // con menos de una semana no hay ritmo confiable
  const start = trendAt(series, from);
  const kgPerWeek = ((end - start) / span) * 7;
  return { kgPerWeek: r2(kgPerWeek), pctPerWeek: r2((kgPerWeek / end) * 100), change: r2(end - start), days: span, partial: span < 28 };
}

/**
 * Proyección hacia la meta. La dirección (bajar o subir) sale del peso de partida (`startKg`, p. ej.
 * la tendencia cuando se puso la meta): así, si la meta era bajar a 86 y hoy estás en 85,9, está
 * alcanzada (y no "falta subir 0,1").
 * - reached: la tendencia ya llegó (o pasó) la meta.
 * - etaDate: con el ritmo actual, cuándo llegás (null si el ritmo va para el otro lado o es ~0).
 * - atTargetDate: dónde estarías en la fecha objetivo con el ritmo actual.
 * - neededKgPerWeek / neededPct: el ritmo que hace falta para llegar en la fecha objetivo.
 */
export function projection({ current, kgPerWeek, target, targetDate = null, today, startKg = null }) {
  const from = startKg ?? current;
  const out = { reached: false, direction: target < from ? "down" : target > from ? "up" : "none", etaDate: null, atTargetDate: null, neededKgPerWeek: null, neededPct: null, weeksLeft: null };
  if (current == null || target == null) return out;
  const remaining = target - current;
  if (Math.abs(remaining) < 0.05 || (out.direction === "down" && current <= target) || (out.direction === "up" && current >= target)) {
    out.reached = true;
    return out;
  }
  if (kgPerWeek && Math.sign(kgPerWeek) === Math.sign(remaining) && Math.abs(kgPerWeek) >= 0.01) out.etaDate = addDays(today, Math.ceil((remaining / kgPerWeek) * 7));
  if (targetDate && targetDate > today) {
    const weeks = daysBetween(today, targetDate) / 7;
    out.weeksLeft = r2(weeks);
    out.atTargetDate = kgPerWeek != null ? r2(current + kgPerWeek * weeks) : null;
    out.neededKgPerWeek = r2(remaining / weeks);
    out.neededPct = r2((Math.abs(remaining / weeks) / current) * 100);
  }
  return out;
}

/** Semáforo: % de peso por semana contra el rango saludable (en valor absoluto). */
export function rateStatus(pctPerWeek, { min = 0.25, max = 0.7 } = {}) {
  if (pctPerWeek == null) return "unknown";
  const a = Math.abs(pctPerWeek);
  return a < min ? "slow" : a > max ? "fast" : "healthy";
}

/** Promedio por semana (lunes a domingo) con la diferencia contra la semana anterior; la más reciente primero. */
export function weeklyAverages(weighIns) {
  const weeks = new Map();
  for (const w of weighIns) {
    if (!(w.kg > 0)) continue;
    const ws = weekStart(w.day);
    const e = weeks.get(ws) || { sum: 0, n: 0 };
    weeks.set(ws, { sum: e.sum + w.kg, n: e.n + 1 });
  }
  const rows = [...weeks]
    .map(([start, e]) => ({ weekStart: start, weekEnd: addDays(start, 6), avg: r2(e.sum / e.n), count: e.n }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  rows.forEach((r, i) => (r.diff = i ? r2(r.avg - rows[i - 1].avg) : null));
  return rows.reverse();
}

/** ¿El valor nuevo parece un error de tipeo? (salto grande contra la tendencia). No bloquea: avisa. */
export function typoCheck(kg, trend, thresholdKg = 3) {
  if (trend == null || !(kg > 0)) return { suspicious: false, diff: null };
  const diff = r2(kg - trend);
  return { suspicious: Math.abs(diff) > thresholdKg, diff };
}
