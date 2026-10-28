// Entreno en vivo: estado y acciones como un reducer puro. Todo lo que depende del reloj o de ids
// nuevos llega en la acción (now, ids), así se puede testear y guardar/recuperar tal cual.
// El estado entero se guarda en el celular después de cada cambio y se sube como snapshot.
import { detectRecord, exerciseRecords } from "./strength.js";
import { platesPerSide } from "./plates.js";
import { isCardio, cardioTotals, cardioRecordHits } from "./cardio.js";

/** @typedef {{ id: string, exerciseKey: string, exerciseId: number, type: 'warmup'|'working'|'drop'|'failure', weightKg: number|null, reps: number|null, rir: number|null, completedAt: string|null,
 *   durationSeconds?: number|null, distanceKm?: number|null, level?: number|null, count?: number|null, timerStartedAt?: number|null, timed?: boolean }} LiveSet
 * Las series de cardio usan durationSeconds (siempre) y distancia/nivel/conteo (opcionales); el
 * cronómetro guarda cuándo arrancó (timerStartedAt) y suma al pausar, así sobrevive a la pantalla bloqueada. */

const iso = (now) => new Date(now).toISOString();

const CARDIO_EMPTY = { durationSeconds: null, distanceKm: null, level: null, count: null, timerStartedAt: null, timed: false };

/** Bloques de cardio planificados: el tiempo objetivo (o el de la última vez) repartido, y el nivel sugerido. */
function plannedCardio(ex, newId) {
  const p = ex.prescription || {};
  const blocks = Math.max(1, p.sets || 1);
  const target = ex.suggestion?.durationSeconds ?? (p.targetMinutes ? p.targetMinutes * 60 : null) ?? ex.previous?.totals?.durationSeconds ?? null;
  const level = ex.suggestion?.level ?? ex.previous?.totals?.level ?? null;
  return Array.from({ length: blocks }, () => ({
    id: newId(),
    exerciseKey: ex.key,
    exerciseId: ex.exerciseId,
    type: "working",
    weightKg: null,
    reps: null,
    rir: null,
    completedAt: null,
    ...CARDIO_EMPTY,
    durationSeconds: target ? Math.round(target / blocks) : null,
    level,
  }));
}

/** Series planificadas de un ejercicio a partir de la sugerencia (peso y reps objetivo). */
function plannedSets(ex, newId) {
  if (isCardio(ex.exercise)) return plannedCardio(ex, newId);
  const p = ex.prescription || { sets: 3, repMin: 8, repMax: 12 };
  const prevWorking = (ex.previous?.sets || []).filter((s) => s.type === "working");
  const weight = ex.suggestion?.weightKg ?? prevWorking[0]?.weightKg ?? (ex.exercise?.isBodyweight ? 0 : null);
  return Array.from({ length: p.sets }, (_, i) => ({
    id: newId(),
    exerciseKey: ex.key,
    exerciseId: ex.exerciseId,
    type: "working",
    weightKg: weight,
    reps: ex.suggestion?.targetReps?.[i] ?? p.repMin,
    rir: null,
    completedAt: null,
  }));
}

/**
 * Estado inicial a partir de lo que trae el server al empezar (rutina, sugerencias, anteriores, récords).
 * @param {{ session: object, exercises: object[], settings: object }} start
 * @param {{ now: number, newId: () => string }} ctx
 */
export function initWorkout(start, { now, newId }) {
  const exercises = (start.exercises || []).map((ex) => ({ ...ex, key: newId() }));
  return {
    v: 1,
    session: { ...start.session, id: start.session.id ?? newId(), startedAt: iso(now), endedAt: null, status: "in_progress", updatedAt: iso(now) },
    settings: start.settings || {},
    meta: { priorityMuscles: start.priorityMuscles || [] },
    exercises,
    sets: exercises.flatMap((ex) => plannedSets(ex, newId)),
    current: exercises[0]?.key ?? null,
    rest: null,
    prs: [],
    syncedAt: null,
  };
}

const touch = (state, now) => ({ ...state, session: { ...state.session, updatedAt: iso(now) } });
const exerciseOf = (state, key) => state.exercises.find((e) => e.key === key);
const setsOf = (state, key) => state.sets.filter((s) => s.exerciseKey === key);

/** Récords contra los que se compara una serie: los históricos más lo ya hecho hoy antes de esa serie. */
function recordsBefore(state, set) {
  const ex = exerciseOf(state, set.exerciseKey);
  const base = ex?.records || { bestE1rm: null, byReps: {} };
  const today = state.sets
    .filter((s) => s.exerciseId === set.exerciseId && s.id !== set.id && s.type === "working" && s.completedAt && s.reps > 0)
    .map((s) => ({ weightKg: s.weightKg ?? 0, reps: s.reps, date: state.session.startedAt, bodyweightKg: state.session.bodyweightKg }));
  if (!today.length) return base;
  const mine = exerciseRecords(today, { isBodyweight: ex?.exercise?.isBodyweight });
  const bestE1rm = !base.bestE1rm || (mine.bestE1rm && mine.bestE1rm.value > base.bestE1rm.value) ? mine.bestE1rm ?? base.bestE1rm : base.bestE1rm;
  const byReps = { ...base.byReps };
  for (const [r, v] of Object.entries(mine.byReps)) if (!byReps[r] || v.weightKg > byReps[r].weightKg) byReps[r] = v;
  return { bestE1rm, byReps };
}

/** Descanso que corresponde después de una serie (calentamiento: fijo; cardio: el de la prescripción, por defecto ninguno). */
export function restFor(state, set) {
  if (set.type === "warmup") return state.settings.warmupRestSeconds ?? 60;
  const ex = exerciseOf(state, set.exerciseKey);
  if (isCardio(ex?.exercise)) return ex?.prescription?.restSeconds ?? 0;
  return ex?.prescription?.restSeconds ?? 90;
}

/** Segundos del cronómetro de una serie de cardio (lo acumulado más lo que corre ahora). */
export const elapsedSeconds = (set, now) => (set?.durationSeconds || 0) + (set?.timerStartedAt ? Math.max(0, Math.round((now - set.timerStartedAt) / 1000)) : 0);

/** Frena el cronómetro de una serie (suma lo corrido). */
const stopTimer = (s, now) => (s.timerStartedAt ? { ...s, durationSeconds: elapsedSeconds(s, now), timerStartedAt: null } : s);

/** Récords de cardio en vivo: los totales del ejercicio hoy contra los históricos (un aviso por ejercicio). */
function withCardioPrs(state, exerciseKey) {
  const ex = exerciseOf(state, exerciseKey);
  if (!isCardio(ex?.exercise)) return state;
  const prs = state.prs.filter((p) => !(p.cardio && p.exerciseKey === exerciseKey));
  const own = setsOf(state, exerciseKey);
  const hits = cardioRecordHits(cardioTotals(own), ex.cardioRecords);
  const last = [...own].reverse().find((s) => s.completedAt);
  if (hits.length && last) prs.push({ setId: last.id, exerciseKey, exerciseId: ex.exerciseId, cardio: hits });
  return { ...state, prs };
}

/**
 * @param {object} state
 * @param {{ type: string, now: number, [k: string]: any }} action
 */
export function workoutReducer(state, action) {
  const { now } = action;
  switch (action.type) {
    case "edit": {
      // Cambiar kg, reps o RIR de una serie (o tiempo, distancia, nivel y conteo en cardio).
      const set = state.sets.find((s) => s.id === action.setId);
      if (!set) return state;
      const patch = { [action.field]: action.value };
      // Corregir el tiempo a mano con el cronómetro andando: sigue corriendo desde el valor nuevo.
      if (action.field === "durationSeconds") Object.assign(patch, { timed: true, timerStartedAt: set.timerStartedAt ? now : null });
      const sets = state.sets.map((s) => (s.id === set.id ? { ...s, ...patch } : s));
      return touch(withCardioPrs({ ...state, sets }, set.exerciseKey), now);
    }
    case "timerToggle": {
      // Cronómetro de cardio: arrancar / pausar (uno solo a la vez). La primera vez arranca de cero, no del objetivo.
      const set = state.sets.find((s) => s.id === action.setId);
      if (!set || set.completedAt) return state;
      const sets = state.sets.map((s) => {
        if (s.id !== set.id || s.timerStartedAt) return stopTimer(s, now);
        return { ...s, durationSeconds: s.timed ? s.durationSeconds || 0 : 0, timed: true, timerStartedAt: now };
      });
      return touch({ ...state, sets }, now);
    }
    case "toggleDone": {
      const set = state.sets.find((s) => s.id === action.setId);
      if (!set) return state;
      if (set.completedAt) {
        // Destildar: deja de contar y se va su aviso de récord.
        const undone = { ...state, sets: state.sets.map((s) => (s.id === set.id ? { ...s, completedAt: null } : s)), prs: state.prs.filter((p) => p.setId !== set.id), rest: state.rest?.setId === set.id ? null : state.rest };
        return touch(withCardioPrs(undone, set.exerciseKey), now);
      }
      const done = { ...stopTimer(set, now), completedAt: iso(now) };
      const ex = exerciseOf(state, set.exerciseKey);
      let prs = state.prs;
      if (done.type === "working" && done.reps > 0) {
        const hit = detectRecord(done, recordsBefore(state, done), { isBodyweight: ex?.exercise?.isBodyweight, bodyweightKg: state.session.bodyweightKg });
        if (hit.e1rm || hit.reps) prs = [...prs, { setId: done.id, exerciseId: done.exerciseId, e1rm: hit.e1rm, reps: hit.reps, e1rmValue: hit.e1rmValue, weightKg: done.weightKg, repsCount: done.reps }];
      }
      const seconds = restFor(state, done);
      const sets = state.sets.map((s) => (s.id === done.id ? done : s));
      // Si terminó todas las series del ejercicio, el siguiente pasa a ser el actual.
      const pending = sets.some((s) => s.exerciseKey === done.exerciseKey && !s.completedAt);
      const nextKey = pending ? state.current : state.exercises.find((e) => sets.some((s) => s.exerciseKey === e.key && !s.completedAt))?.key ?? state.current;
      const rest = seconds > 0 ? { setId: done.id, startedAt: now, endsAt: now + seconds * 1000, seconds } : null;
      return touch(withCardioPrs({ ...state, sets, prs, current: nextKey, rest }, done.exerciseKey), now);
    }
    case "addSet": {
      const own = setsOf(state, action.exerciseKey);
      const last = [...own].reverse().find((s) => s.type === (action.setType ?? "working")) ?? own.at(-1);
      const ex = exerciseOf(state, action.exerciseKey);
      const set = isCardio(ex.exercise)
        ? { id: action.id, exerciseKey: action.exerciseKey, exerciseId: ex.exerciseId, type: "working", weightKg: null, reps: null, rir: null, completedAt: null, ...CARDIO_EMPTY, durationSeconds: last?.durationSeconds ?? null, level: last?.level ?? null }
        : { id: action.id, exerciseKey: action.exerciseKey, exerciseId: ex.exerciseId, type: action.setType ?? "working", weightKg: last?.weightKg ?? null, reps: last?.reps ?? ex.prescription?.repMin ?? null, rir: null, completedAt: null };
      // Un calentamiento va antes de las series de trabajo; el resto, al final del ejercicio.
      const idx = state.sets.findIndex((s) => s.exerciseKey === action.exerciseKey && (set.type === "warmup" ? s.type !== "warmup" : false));
      const lastIdx = state.sets.map((s) => s.exerciseKey).lastIndexOf(action.exerciseKey);
      const at = set.type === "warmup" && idx >= 0 ? idx : lastIdx + 1;
      const sets = [...state.sets.slice(0, at), set, ...state.sets.slice(at)];
      return touch({ ...state, sets }, now);
    }
    case "removeSet":
      return touch({ ...state, sets: state.sets.filter((s) => s.id !== action.setId), prs: state.prs.filter((p) => p.setId !== action.setId) }, now);
    case "toggleWarmup": {
      const sets = state.sets.map((s) => (s.id === action.setId ? { ...s, type: s.type === "warmup" ? "working" : "warmup" } : s));
      return touch({ ...state, sets, prs: state.prs.filter((p) => p.setId !== action.setId) }, now);
    }
    case "addExercise": {
      const ex = { ...action.exercise, key: action.key };
      const sets = plannedSets(ex, action.newId);
      return touch({ ...state, exercises: [...state.exercises, ex], sets: [...state.sets, ...sets], current: ex.key }, now);
    }
    case "swapExercise": {
      // Cambiar por otro (p. ej. la máquina está ocupada): mantiene las series hechas del original
      // (se quedan con su ejercicio) y reemplaza las pendientes por las del nuevo.
      const old = exerciseOf(state, action.key);
      if (!old) return state;
      const fresh = { ...action.exercise, key: action.newKey, prescription: { ...old.prescription, ...action.exercise.prescription } };
      const doneOld = setsOf(state, old.key).filter((s) => s.completedAt);
      const exercises = state.exercises.flatMap((e) => (e.key !== old.key ? [e] : doneOld.length ? [e, fresh] : [fresh]));
      const pendingCount = setsOf(state, old.key).filter((s) => !s.completedAt).length || fresh.prescription.sets;
      const newSets = plannedSets({ ...fresh, prescription: { ...fresh.prescription, sets: pendingCount } }, action.newId);
      const sets = [];
      for (const s of state.sets) {
        if (s.exerciseKey !== old.key) sets.push(s);
        else if (s.completedAt) sets.push(s);
      }
      const at = sets.map((s) => s.exerciseKey).lastIndexOf(old.key);
      const insertAt = at >= 0 ? at + 1 : state.sets.findIndex((s) => s.exerciseKey === old.key);
      const merged = insertAt >= 0 ? [...sets.slice(0, insertAt), ...newSets, ...sets.slice(insertAt)] : [...sets, ...newSets];
      return touch({ ...state, exercises, sets: merged, current: fresh.key }, now);
    }
    case "removeExercise": {
      const exercises = state.exercises.filter((e) => e.key !== action.key);
      const sets = state.sets.filter((s) => s.exerciseKey !== action.key);
      const ids = new Set(sets.map((s) => s.id));
      return touch({ ...state, exercises, sets, prs: state.prs.filter((p) => ids.has(p.setId)), current: state.current === action.key ? exercises[0]?.key ?? null : state.current }, now);
    }
    case "select":
      return { ...state, current: action.key };
    case "restAdjust":
      return state.rest ? { ...state, rest: { ...state.rest, endsAt: Math.max(now, state.rest.endsAt + action.seconds * 1000) } } : state;
    case "restSkip":
      return { ...state, rest: null };
    case "notes":
      return touch({ ...state, session: { ...state.session, notes: action.value } }, now);
    case "finish":
      return touch({ ...state, rest: null, sets: state.sets.map((s) => stopTimer(s, now)), session: { ...state.session, status: "done", endedAt: iso(now) } }, now);
    case "discard":
      return touch({ ...state, rest: null, session: { ...state.session, status: "discarded", endedAt: iso(now) } }, now);
    case "synced":
      // El server confirmó hasta esta versión (no cambia updatedAt).
      return { ...state, syncedAt: action.version };
    default:
      return state;
  }
}

/** ¿Hay cambios sin subir? */
export const isDirty = (state) => !state.syncedAt || state.syncedAt < state.session.updatedAt;

/** Lo que se sube al server: la sesión y sus series con el orden de cada una. */
export function toSnapshot(state) {
  const order = new Map(state.exercises.map((e, i) => [e.key, i]));
  const counters = new Map();
  return {
    ...state.session,
    sets: state.sets
      .filter((s) => order.has(s.exerciseKey))
      .map((s) => {
        const n = counters.get(s.exerciseKey) ?? 0;
        counters.set(s.exerciseKey, n + 1);
        return {
          id: s.id,
          exerciseId: s.exerciseId,
          exerciseOrder: order.get(s.exerciseKey),
          setOrder: n,
          type: s.type,
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          durationSeconds: s.durationSeconds ?? null,
          distanceKm: s.distanceKm ?? null,
          level: s.level ?? null,
          count: s.count ?? null,
          completedAt: s.completedAt,
          updatedAt: state.session.updatedAt,
        };
      }),
  };
}

/** Avance: series hechas / totales y el estado de cada ejercicio (para las barritas de arriba). */
export function progress(state) {
  const per = state.exercises.map((e) => {
    const own = setsOf(state, e.key).filter((s) => s.type !== "warmup");
    const done = own.filter((s) => s.completedAt).length;
    return { key: e.key, done, total: own.length, complete: own.length > 0 && done === own.length };
  });
  return { done: per.reduce((s, x) => s + x.done, 0), total: per.reduce((s, x) => s + x.total, 0), perExercise: per };
}

/** Segundos que quedan de descanso (negativo si ya pasó). Se calcula con el reloj, no con un contador. */
export const restRemaining = (rest, now) => (rest ? Math.ceil((rest.endsAt - now) / 1000) : null);

/** Discos por lado para el peso de una serie (solo ejercicios con barra). */
export function platesFor(exercise, weightKg, settings) {
  if (exercise?.equipment !== "barra" || !(weightKg > 0)) return null;
  const barKg = settings.bars?.[exercise.bar || "olimpica"] ?? (exercise.bar === "z" ? 10 : 20);
  return { ...platesPerSide(weightKg, barKg, settings.plates || {}), barKg, bar: exercise.bar || "olimpica" };
}

/**
 * Rearma el estado a partir de una sesión guardada en el server (retomar desde otro dispositivo).
 * @param {{ session, settings, priorityMuscles, exercises }} start datos de inicio de esa rutina
 * @param {{ id, title, routineId, planId, startedAt, status, bodyweightKg, notes, updatedAt, sets: object[] }} saved
 * @param {Map<number, object>} extra datos de ejercicios que no estaban en la rutina (agregados en el entreno)
 */
export function fromSavedSession(start, saved, extra, { newId }) {
  const byOrder = new Map();
  for (const s of [...saved.sets].sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setOrder - b.setOrder)) {
    if (!byOrder.has(s.exerciseOrder)) byOrder.set(s.exerciseOrder, { exerciseId: s.exerciseId, sets: [] });
    byOrder.get(s.exerciseOrder).sets.push(s);
  }
  const exercises = [];
  const sets = [];
  for (const group of byOrder.values()) {
    const data = start.exercises.find((e) => e.exerciseId === group.exerciseId) ?? extra.get(group.exerciseId);
    if (!data) continue;
    const key = newId();
    exercises.push({ ...data, key });
    for (const s of group.sets)
      sets.push({
        id: s.id,
        exerciseKey: key,
        exerciseId: s.exerciseId,
        type: s.type,
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
        completedAt: s.completedAt,
        ...(isCardio(data.exercise) ? { ...CARDIO_EMPTY, durationSeconds: s.durationSeconds ?? null, distanceKm: s.distanceKm ?? null, level: s.level ?? null, count: s.count ?? null, timed: s.durationSeconds != null } : {}),
      });
  }
  const pendingKey = exercises.find((e) => sets.some((s) => s.exerciseKey === e.key && !s.completedAt))?.key;
  return {
    v: 1,
    session: { id: saved.id, routineId: saved.routineId, planId: saved.planId, title: saved.title, startedAt: saved.startedAt, endedAt: saved.endedAt, status: saved.status, bodyweightKg: saved.bodyweightKg, notes: saved.notes, updatedAt: saved.updatedAt },
    settings: start.settings || {},
    meta: { priorityMuscles: start.priorityMuscles || [] },
    exercises,
    sets,
    current: pendingKey ?? exercises[0]?.key ?? null,
    rest: null,
    prs: [],
    syncedAt: saved.updatedAt,
  };
}
