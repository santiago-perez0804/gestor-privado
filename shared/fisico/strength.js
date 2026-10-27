// Fuerza: 1RM estimado (Epley), ejercicios de peso corporal, récords y detección de récords en vivo.
// Funciones puras: reciben series ya filtradas (las que cuentan son las "working" completadas).

/** Epley pierde precisión con muchas repeticiones: arriba de 12 no se estima. */
export const MAX_EPLEY_REPS = 12;

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * 1RM estimado con la fórmula de Epley: peso × (1 + reps ÷ 30). null si no aplica
 * (reps fuera de 1–12 o sin peso).
 */
export function epley(weightKg, reps) {
  if (!(reps >= 1 && reps <= MAX_EPLEY_REPS) || !(weightKg > 0)) return null;
  return weightKg * (1 + reps / 30);
}

/**
 * 1RM estimado de una serie, comparable entre sesiones.
 * - Ejercicio con peso externo: Epley sobre el peso.
 * - Peso corporal: Epley sobre (peso corporal del día + lastre) y se expresa como **lastre
 *   equivalente** (lo que podrías colgarte para 1 repetición), p. ej. +24 kg en dominadas.
 * @returns {{ value: number, bodyweight: boolean } | null}
 */
export function setE1rm({ weightKg, reps }, { isBodyweight = false, bodyweightKg = null } = {}) {
  if (isBodyweight) {
    if (!(bodyweightKg > 0) || !(reps >= 1 && reps <= MAX_EPLEY_REPS)) return null;
    const total = epley(bodyweightKg + (weightKg || 0), reps);
    return { value: round1(total - bodyweightKg), bodyweight: true };
  }
  const v = epley(weightKg, reps);
  return v == null ? null : { value: round1(v), bodyweight: false };
}

/** Las series que cuentan: de trabajo, completadas y con repeticiones. */
export const countsAsWork = (s) => (s.type ?? "working") === "working" && !!s.completedAt && s.reps > 0;

/**
 * Récords de un ejercicio a partir de su historial de series de trabajo.
 * @param {{ weightKg: number, reps: number, date: string, sessionId?: string, bodyweightKg?: number }[]} sets
 * @param {{ isBodyweight?: boolean }} exercise
 * @returns {{ bestE1rm: null | { value, weightKg, reps, date, sessionId }, byReps: Record<number, { weightKg, date, sessionId }> }}
 */
export function exerciseRecords(sets, { isBodyweight = false } = {}) {
  let bestE1rm = null;
  const byReps = {};
  // Orden cronológico: ante un empate queda el primero (el récord es de cuando se logró).
  const sorted = [...sets].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  for (const s of sorted) {
    if (!(s.reps > 0)) continue;
    const e = setE1rm(s, { isBodyweight, bodyweightKg: s.bodyweightKg });
    if (e && (!bestE1rm || e.value > bestE1rm.value)) bestE1rm = { value: e.value, weightKg: s.weightKg ?? 0, reps: s.reps, date: s.date, sessionId: s.sessionId ?? null };
    const w = s.weightKg ?? 0;
    if (!byReps[s.reps] || w > byReps[s.reps].weightKg) byReps[s.reps] = { weightKg: w, date: s.date, sessionId: s.sessionId ?? null };
  }
  return { bestE1rm, byReps };
}

/**
 * ¿Esta serie es un récord contra los récords que había antes de la sesión?
 * - e1rm: supera el mejor 1RM estimado.
 * - reps: es el mayor peso levantado para esa cantidad de repeticiones (o la primera vez con esas reps
 *   cuando ya había historial del ejercicio).
 */
export function detectRecord(set, records, { isBodyweight = false, bodyweightKg = null } = {}) {
  const out = { e1rm: false, reps: false, e1rmValue: null };
  if (!(set.reps > 0)) return out;
  const e = setE1rm(set, { isBodyweight, bodyweightKg });
  out.e1rmValue = e?.value ?? null;
  const hasHistory = !!records && (records.bestE1rm || Object.keys(records.byReps || {}).length > 0);
  if (!hasHistory) return out; // la primera vez no es "récord": no hay contra qué comparar
  if (e && (!records.bestE1rm || e.value > records.bestE1rm.value + 1e-9)) out.e1rm = true;
  const prev = records.byReps?.[set.reps];
  const w = set.weightKg ?? 0;
  if (prev ? w > prev.weightKg + 1e-9 : false) out.reps = true;
  return out;
}

/**
 * Evolución por sesión: el mejor 1RM estimado de cada día y si ese día fue récord.
 * @param {{ date: string, sessionId?: string, sets: { weightKg, reps, bodyweightKg? }[] }[]} sessions
 */
export function e1rmHistory(sessions, { isBodyweight = false } = {}) {
  let best = -Infinity;
  return [...sessions]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((s) => {
      let top = null;
      let total = null;
      for (const x of s.sets) {
        const e = setE1rm(x, { isBodyweight, bodyweightKg: x.bodyweightKg });
        if (e && (top == null || e.value > top)) {
          top = e.value;
          total = isBodyweight ? e.value + x.bodyweightKg : e.value;
        }
      }
      const record = top != null && top > best + 1e-9;
      if (top != null) best = Math.max(best, top);
      return { date: s.date, sessionId: s.sessionId ?? null, e1rm: top, total, record, sets: s.sets };
    });
}

/**
 * Cambio porcentual del 1RM estimado entre la primera y la última sesión con dato. En peso corporal
 * se compara la carga total (cuerpo + lastre): de +5 a +10 kg de lastre no es "+100 %".
 */
export function e1rmChangePct(history) {
  const withValue = history.filter((h) => h.total != null);
  if (withValue.length < 2) return null;
  const first = withValue[0].total;
  const last = withValue.at(-1).total;
  if (!(first > 0)) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}
