// La semana de entrenamiento: qué tocaba cada día, qué se hizo, y la regla de reprogramación
// (si faltás, la rutina no se pierde: pasa al siguiente día libre de la semana).
import { addDays, weekday } from "./dates.js";

/**
 * @param {{ days: string[], schedule: Record<number, { routineId: number|null, extras?: string[] }>,
 *   sessions: { localDate: string, routineId: number|null }[], today: string }} input
 *   days: los 7 días de la semana (lunes a domingo); sessions: entrenos terminados de esa semana.
 * @returns {{ days: object[], planned: number, done: number }}
 */
export function weekPlan({ days, schedule = {}, sessions = [], today }) {
  const slots = days
    .map((date) => ({ date, routineId: schedule[weekday(date)]?.routineId ?? null, matchedOn: null }))
    .filter((s) => s.routineId != null);

  // Cada entreno hecho "cumple" un día planificado de esa rutina: el mismo día; si no, el pendiente
  // más viejo (se hizo después: primero se salda la deuda más antigua); si no, el primero posterior
  // (se adelantó).
  const done = [...sessions].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const extraDone = [];
  for (const s of done) {
    const free = slots.filter((x) => x.routineId === s.routineId && !x.matchedOn);
    const slot = free.find((x) => x.date === s.localDate) ?? free.find((x) => x.date < s.localDate) ?? free.find((x) => x.date > s.localDate);
    if (slot && s.routineId != null) slot.matchedOn = s.localDate;
    else extraDone.push(s);
  }

  // Lo que se faltó (antes de hoy y sin hacer) pasa al siguiente día libre desde hoy.
  const routineDays = new Set(slots.map((x) => x.date));
  const doneDays = new Set(done.map((s) => s.localDate));
  const hosting = new Map(); // día → { routineId, from }
  for (const slot of slots) {
    if (slot.matchedOn || slot.date >= today) continue;
    const target = days.find((d) => d > slot.date && d >= today && !routineDays.has(d) && !hosting.has(d) && !doneDays.has(d));
    if (target) {
      hosting.set(target, { routineId: slot.routineId, from: slot.date });
      slot.movedTo = target;
    }
  }

  const tomorrow = addDays(today, 1);
  const out = days.map((date) => {
    const planned = slots.find((x) => x.date === date);
    const moved = hosting.get(date);
    const doneHere = done.filter((s) => s.localDate === date).map((s) => s.routineId);
    const day = {
      date,
      weekday: weekday(date),
      extras: schedule[weekday(date)]?.extras ?? [],
      plannedRoutineId: planned?.routineId ?? null,
      routineId: moved?.routineId ?? planned?.routineId ?? null,
      movedFrom: moved?.from ?? null,
      movedTo: planned?.movedTo ?? (planned?.matchedOn && planned.matchedOn !== date ? planned.matchedOn : null),
      doneRoutineIds: doneHere,
      status: "rest",
    };
    if (doneHere.length) day.status = "done";
    else if (planned?.matchedOn && planned.matchedOn !== date) day.status = "moved";
    else if (day.routineId != null && (moved || !planned?.matchedOn)) {
      if (date === today) day.status = "today";
      else if (date === tomorrow) day.status = "tomorrow";
      else if (date > today) day.status = "pending";
      else day.status = planned?.movedTo ? "moved" : "skipped";
    }
    return day;
  });
  return { days: out, planned: slots.length, done: slots.filter((s) => s.matchedOn).length, extraSessions: extraDone.length };
}

/** El próximo entreno por hacer (hoy si todavía no lo hiciste, si no el siguiente). */
export function nextWorkout(plan) {
  return plan.days.find((d) => ["today", "tomorrow", "pending"].includes(d.status) && d.routineId != null) ?? null;
}

/** ¿La semana está cumplida? (al menos `threshold` de los entrenos planificados). */
export const weekMet = ({ planned, done }, threshold = 0.8) => planned > 0 && done / planned >= threshold - 1e-9;

/**
 * Racha de semanas cumplidas: las anteriores seguidas (de la más reciente para atrás) y la actual
 * solo si ya está cumplida. Las semanas sin nada planificado no cortan ni suman.
 * @param {{ planned: number, done: number }[]} pastWeeks de la más reciente a la más vieja
 */
export function weekStreak(pastWeeks, current, threshold = 0.8) {
  let streak = 0;
  for (const w of pastWeeks) {
    if (!w.planned) continue;
    if (!weekMet(w, threshold)) break;
    streak += 1;
  }
  return streak + (current && weekMet(current, threshold) ? 1 : 0);
}
