// Volumen semanal por músculo, con conteo fraccional (Pelland et al., 2024): cada serie suma 1 al
// músculo primario del ejercicio y ½ a cada secundario.
import { MUSCLE_IDS } from "./constants.js";

const half = (n) => Math.round(n * 2) / 2;

/** Series que aporta un ejercicio a cada músculo. */
export function contributions(muscles, sets = 1) {
  const out = {};
  for (const m of muscles || []) out[m.muscle] = (out[m.muscle] || 0) + sets * (m.role === "primary" ? 1 : 0.5);
  return out;
}

const add = (acc, part) => {
  for (const [k, v] of Object.entries(part)) acc[k] = (acc[k] || 0) + v;
  return acc;
};

/**
 * Series planificadas en la semana: las de cada rutina por la cantidad de veces que aparece en la agenda.
 * @param {(number|null)[]} routineIdsOfWeek rutina de cada día (7 valores, null = sin rutina)
 * @param {Map<number, { exerciseId: number, sets: number }[]>} routineExercises
 * @param {Map<number, { muscles: { muscle, role }[] }>} exercises
 */
export function plannedVolume(routineIdsOfWeek, routineExercises, exercises) {
  const acc = {};
  for (const rid of routineIdsOfWeek) {
    if (rid == null) continue;
    for (const re of routineExercises.get(rid) || []) add(acc, contributions(exercises.get(re.exerciseId)?.muscles, re.sets));
  }
  return acc;
}

/** Series de una rutina sola (para el resumen de cada rutina). */
export const routineVolume = (items, exercises) => items.reduce((acc, re) => add(acc, contributions(exercises.get(re.exerciseId)?.muscles, re.sets)), {});

/**
 * Series hechas: solo las de trabajo completadas.
 * @param {{ exerciseId: number, type?: string, completedAt?: string }[]} sets
 */
export function doneVolume(sets, exercises) {
  const acc = {};
  for (const s of sets) {
    if ((s.type ?? "working") !== "working" || !s.completedAt) continue;
    add(acc, contributions(exercises.get(s.exerciseId)?.muscles, 1));
  }
  return acc;
}

/** Bajo / en rango / alto contra el rango de referencia. */
export const volumeStatus = (sets, { min, max }) => (sets < min ? "low" : sets > max ? "high" : "in_range");

/**
 * Filas por músculo: planificadas, hechas y estado. El estado mira lo planificado (si el plan alcanza
 * para la semana); sin plan, mira lo hecho.
 * @returns {{ muscle: string, planned: number, done: number, status: string, priority: boolean }[]}
 */
export function weeklyVolume({ planned = {}, done = {}, range = { min: 10, max: 20 }, priorityMuscles = [] }) {
  const hasPlan = Object.values(planned).some((v) => v > 0);
  return MUSCLE_IDS.map((muscle) => {
    const p = half(planned[muscle] || 0);
    const d = half(done[muscle] || 0);
    return { muscle, planned: p, done: d, status: volumeStatus(hasPlan ? p : d, range), priority: priorityMuscles.includes(muscle) };
  });
}

/**
 * Sugerencia corta para los músculos que quedan cortos (excluye los que el plan deja bajos a propósito).
 * @returns {{ muscle: string, planned: number, missing: number }[]}
 */
export function shortMuscles(rows, { min = 10, ignore = [] } = {}) {
  return rows.filter((r) => r.planned > 0 && r.planned < min && !ignore.includes(r.muscle)).map((r) => ({ muscle: r.muscle, planned: r.planned, missing: half(min - r.planned) }));
}
