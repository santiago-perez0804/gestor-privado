// Doble progresión: sugerencia para la próxima sesión de un ejercicio.
// 1) Si en la última sesión TODAS las series de trabajo llegaron al tope de reps → subir un paso de peso.
// 2) Si dos sesiones seguidas quedaron por debajo del mínimo de reps → bajar ~7,5 % (entre 5 y 10).
// 3) Si no → mismo peso, apuntando a +1 rep en la serie más floja.
// En peso corporal el "peso" es el lastre, y el paso se suma al lastre.

const DECREASE = 0.075;

/** Peso de trabajo de una sesión: el más usado entre sus series (ante empate, el más alto). */
export function workingWeight(sets) {
  const counts = new Map();
  for (const s of sets) counts.set(s.weightKg ?? 0, (counts.get(s.weightKg ?? 0) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
}

/** ¿La sesión quedó por debajo del mínimo? (más de la mitad de las series de trabajo bajo repMin). */
export const belowMin = (sets, repMin) => sets.length > 0 && sets.filter((s) => s.reps < repMin).length > sets.length / 2;

/** Redondea a un múltiplo del paso (para no sugerir pesos que no existen). */
const toStep = (kg, step) => Math.round(kg / step) * step;

/**
 * @param {{ sets: number, repMin: number, repMax: number }} prescription
 * @param {{ date: string, sets: { weightKg: number, reps: number }[] }[]} history sesiones previas, la más reciente primero (solo series de trabajo completadas)
 * @param {{ stepKg: number }} options paso del equipo (configurable)
 * @returns {{ kind: 'start'|'increase'|'reps'|'decrease', weightKg: number|null, targetReps: number[], previous: object|null }}
 */
export function suggestNext(prescription, history, { stepKg = 2.5 } = {}) {
  const { sets: plannedSets = 3, repMin, repMax } = prescription;
  const last = history.find((h) => h.sets.length > 0);
  if (!last) return { kind: "start", weightKg: null, targetReps: Array(plannedSets).fill(repMin), previous: null };

  const weight = workingWeight(last.sets);
  const atWeight = last.sets.filter((s) => (s.weightKg ?? 0) === weight);
  const previous = { date: last.date, weightKg: weight, reps: atWeight.map((s) => s.reps) };

  // 1) Todas al tope (y por lo menos las series planificadas) → subir.
  if (last.sets.length >= plannedSets && last.sets.every((s) => s.reps >= repMax && (s.weightKg ?? 0) >= weight)) {
    return { kind: "increase", weightKg: Math.round((weight + stepKg) * 100) / 100, targetReps: Array(plannedSets).fill(repMin), previous };
  }

  // 2) Dos sesiones seguidas bajo el mínimo (con el mismo peso o más) → bajar.
  const withSets = history.filter((h) => h.sets.length > 0);
  if (withSets.length >= 2 && belowMin(withSets[0].sets, repMin) && belowMin(withSets[1].sets, repMin) && workingWeight(withSets[1].sets) <= weight) {
    let lower = toStep(weight * (1 - DECREASE), stepKg);
    if (lower >= weight) lower = weight - stepKg;
    return { kind: "decrease", weightKg: Math.max(0, Math.round(lower * 100) / 100), targetReps: Array(plannedSets).fill(repMin), previous };
  }

  // 3) Mismo peso, +1 rep en la serie más floja (sin pasar el tope).
  const reps = Array.from({ length: plannedSets }, (_, i) => atWeight[i]?.reps ?? atWeight.at(-1)?.reps ?? repMin);
  const weakest = reps.indexOf(Math.min(...reps));
  const target = reps.map((r, i) => Math.min(repMax, Math.max(repMin, i === weakest ? r + 1 : r)));
  return { kind: "reps", weightKg: weight, targetReps: target, previous };
}
