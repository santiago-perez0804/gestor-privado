// Cardio: el tiempo va siempre; distancia, nivel (velocidad/inclinación/resistencia) y conteo (saltos,
// pisos, pasos) son opcionales según el ejercicio. Ritmo, minutos de la semana, récords y una
// progresión simple. No cuenta para el volumen por músculo ni para el 1RM.
import { num } from "./format.js";

/** @typedef {{ durationSeconds?: number|null, distanceKm?: number|null, level?: number|null, count?: number|null, completedAt?: string|null, type?: string }} CardioSet */

export const isCardio = (exercise) => exercise?.kind === "cardio";

/** Una serie de cardio cuenta si está completada y tiene tiempo. */
export const cardioDone = (s) => !!s.completedAt && (s.type ?? "working") !== "warmup" && s.durationSeconds > 0;

/** 1500 → "25:00"; 3725 → "1:02:05". */
export function duration(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "–";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Texto escrito → segundos. "25" = 25 min; "25:30" = 25 min 30 s; "1:05:00" = 1 h 5 min.
 * También "25,5" (minutos con decimales). null si no se entiende.
 */
export function parseDuration(text) {
  if (typeof text === "number") return Number.isFinite(text) && text >= 0 ? Math.round(text * 60) : null;
  const t = String(text ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  if (/^\d+([.,]\d+)?$/.test(t)) return Math.round(Number(t.replace(",", ".")) * 60);
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return parts.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
}

/** Ritmo en segundos por km (null sin distancia). */
export const paceSecPerKm = (seconds, km) => (seconds > 0 && km > 0 ? Math.round(seconds / km) : null);

/** Velocidad media en km/h (1 decimal). */
export const speedKmh = (seconds, km) => (seconds > 0 && km > 0 ? Math.round((km / (seconds / 3600)) * 10) / 10 : null);

/** "5:30 /km". */
export const paceText = (secPerKm) => (secPerKm ? `${duration(secPerKm)} /km` : "–");

/** Totales de varias series (bloques) de un mismo ejercicio: tiempo, distancia y conteo suman; el nivel es el máximo. */
export function cardioTotals(sets) {
  const done = sets.filter(cardioDone);
  if (!done.length) return null;
  const sum = (k) => (done.some((s) => s[k] > 0) ? done.reduce((a, s) => a + (s[k] > 0 ? s[k] : 0), 0) : null);
  const levels = done.map((s) => s.level).filter((v) => v != null && v > 0);
  const durationSeconds = sum("durationSeconds");
  const distanceKm = sum("distanceKm");
  return {
    blocks: done.length,
    durationSeconds,
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
    count: sum("count"),
    level: levels.length ? Math.max(...levels) : null,
    paceSecPerKm: paceSecPerKm(durationSeconds, distanceKm),
  };
}

/**
 * "25:00 · 3,2 km · inclinación 8 · 1.200 saltos" (lo que haya).
 * @param {object} totals de cardioTotals (o una serie sola)
 * @param {{ levelLabel?: string|null, countLabel?: string|null }} [exercise]
 */
export function cardioLine(totals, exercise = {}) {
  if (!totals) return "";
  const parts = [duration(totals.durationSeconds)];
  if (totals.distanceKm > 0) parts.push(`${num(totals.distanceKm)} km`);
  if (totals.level != null && totals.level > 0) parts.push(`${exercise.levelLabel || "nivel"} ${num(totals.level)}`);
  if (totals.count > 0) parts.push(`${num(totals.count, { max: 0 })} ${exercise.countLabel || ""}`.trim());
  if (totals.blocks > 1) parts.push(`${totals.blocks} bloques`);
  return parts.join(" · ");
}

/**
 * Récords por sesión: más tiempo, más distancia, mejor ritmo (con al menos 1 km, para no premiar un
 * pique corto) y más conteo. Cada uno con la fecha.
 * @param {{ date: string, sessionId?: string, sets: CardioSet[] }[]} sessions
 */
export function cardioRecords(sessions) {
  const out = { longest: null, farthest: null, bestPace: null, mostCount: null };
  for (const s of [...sessions].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const t = cardioTotals(s.sets);
    if (!t) continue;
    const at = { date: s.date, sessionId: s.sessionId ?? null };
    if (t.durationSeconds > (out.longest?.value ?? 0)) out.longest = { value: t.durationSeconds, ...at };
    if (t.distanceKm > (out.farthest?.value ?? 0)) out.farthest = { value: t.distanceKm, ...at };
    if (t.distanceKm >= 1 && t.paceSecPerKm && (!out.bestPace || t.paceSecPerKm < out.bestPace.value)) out.bestPace = { value: t.paceSecPerKm, ...at };
    if (t.count > (out.mostCount?.value ?? 0)) out.mostCount = { value: t.count, ...at };
  }
  return out;
}

/**
 * ¿Qué récords supera una sesión contra los anteriores? Devuelve los nombres ('longest', 'farthest',
 * 'bestPace', 'mostCount'). Sin historial no hay récord (no había contra qué comparar).
 */
export function cardioRecordHits(totals, records) {
  if (!totals || !records) return [];
  const hits = [];
  if (records.longest && totals.durationSeconds > records.longest.value) hits.push("longest");
  if (records.farthest && totals.distanceKm > records.farthest.value) hits.push("farthest");
  if (records.bestPace && totals.distanceKm >= 1 && totals.paceSecPerKm && totals.paceSecPerKm < records.bestPace.value) hits.push("bestPace");
  if (records.mostCount && totals.count > records.mostCount.value) hits.push("mostCount");
  return hits;
}

export const CARDIO_RECORD_LABELS = { longest: "más tiempo", farthest: "más distancia", bestPace: "mejor ritmo", mostCount: "más repeticiones" };

/**
 * Progresión simple: si llegaste al objetivo de minutos las dos últimas veces, subí un nivel (si el
 * ejercicio tiene nivel y lo venís anotando) o sumá 2 minutos. Si no, repetí.
 * @param {{ targetMinutes?: number|null }} prescription
 * @param {{ date: string, sets: CardioSet[] }[]} history la más reciente primero
 * @param {{ hasLevel?: boolean }} [opts]
 * @returns {{ kind: 'first'|'repeat'|'increase', targetMinutes: number|null, level: number|null, durationSeconds: number|null, reason: string }}
 */
export function suggestCardio(prescription, history, { hasLevel = false } = {}) {
  const target = prescription?.targetMinutes ?? null;
  const last = history.map((h) => cardioTotals(h.sets)).filter(Boolean);
  const lastLevel = last[0]?.level ?? null;
  if (!last.length) return { kind: "first", targetMinutes: target, level: null, durationSeconds: target ? target * 60 : null, reason: "Primera vez: hacé el tiempo objetivo a un ritmo que puedas sostener." };
  const goalSeconds = target ? target * 60 : last[0].durationSeconds;
  const reached = last.slice(0, 2).filter((t) => t.durationSeconds >= goalSeconds);
  if (target && last.length >= 2 && reached.length === 2) {
    if (hasLevel && lastLevel != null) return { kind: "increase", targetMinutes: target, level: lastLevel + 1, durationSeconds: target * 60, reason: `Llegaste a ${target} min dos veces seguidas: subí un nivel.` };
    return { kind: "increase", targetMinutes: target + 2, level: lastLevel, durationSeconds: (target + 2) * 60, reason: `Llegaste a ${target} min dos veces seguidas: probá ${target + 2}.` };
  }
  return { kind: "repeat", targetMinutes: target, level: lastLevel, durationSeconds: goalSeconds, reason: target ? `Apuntá a ${target} min.` : "Repetí lo de la última vez." };
}

/**
 * Minutos de cardio de la semana contra el objetivo, con el desglose por actividad.
 * @param {{ exerciseId: number, name: string, durationSeconds: number }[]} entries series de cardio hechas en la semana
 * @param {number} goalMinutes
 */
export function weeklyCardio(entries, goalMinutes = 150) {
  const by = new Map();
  for (const e of entries) {
    if (!(e.durationSeconds > 0)) continue;
    const cur = by.get(e.exerciseId) ?? { exerciseId: e.exerciseId, name: e.name, seconds: 0 };
    cur.seconds += e.durationSeconds;
    by.set(e.exerciseId, cur);
  }
  const seconds = [...by.values()].reduce((a, x) => a + x.seconds, 0);
  const minutes = Math.round(seconds / 60);
  const goal = goalMinutes > 0 ? goalMinutes : null;
  return {
    minutes,
    goal,
    pct: goal ? Math.min(100, Math.round((minutes / goal) * 100)) : null,
    missing: goal ? Math.max(0, goal - minutes) : null,
    reached: goal ? minutes >= goal : false,
    byActivity: [...by.values()].map((x) => ({ exerciseId: x.exerciseId, name: x.name, minutes: Math.round(x.seconds / 60) })).sort((a, b) => b.minutes - a.minutes),
  };
}
