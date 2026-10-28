// Récords: por ejercicio, el mejor 1RM estimado, la mejor serie, el cambio en las últimas semanas,
// el récord por cantidad de repeticiones y el historial sesión por sesión. También los récords
// recientes para el Inicio. Todo calculado con shared/fisico/strength a partir de set_logs.
import { addDays } from "../../../../shared/fisico/dates.js";
import { e1rmChangePct } from "../../../../shared/fisico/strength.js";
import { setsLine } from "../../../../shared/fisico/format.js";
import { today } from "./common.js";
import { toExercise } from "./exercises.js";

export const CHANGE_WEEKS = 6;

export function createRecords(db, { history, plans }) {
  const exercisesWithData = async () =>
    await db
      .prepare(
        `SELECT e.*, COUNT(DISTINCT l.sessionId) AS sessions, MAX(s.startedAt) AS lastAt
         FROM exercises e JOIN set_logs l ON l.exerciseId = e.id JOIN workout_sessions s ON s.id = l.sessionId
         WHERE s.status = 'done' AND l.type = 'working' AND l.completedAt IS NOT NULL AND l.reps > 0
         GROUP BY e.id ORDER BY lastAt DESC`
      )
      .all();

  const priority = async () => {
    const id = await plans.activeId();
    return id ? (await plans.detail(id)).priorityMuscles : [];
  };

  async function summaryOf(row, prio, t) {
    const exercise = toExercise(row);
    const hist = await history.progress(exercise.id, { isBodyweight: exercise.isBodyweight });
    const recent = hist.filter((h) => h.date >= addDays(t, -7 * CHANGE_WEEKS));
    const best = (await history.records(exercise.id, { isBodyweight: exercise.isBodyweight })).bestE1rm;
    const primary = exercise.muscles.find((m) => m.role === "primary")?.muscle ?? null;
    return {
      exerciseId: exercise.id,
      name: exercise.name,
      isBodyweight: exercise.isBodyweight,
      primaryMuscle: primary,
      priority: !!primary && prio.includes(primary),
      bestE1rm: best,
      changePct: e1rmChangePct(recent),
      sparkline: hist.slice(-10).map((h) => h.e1rm),
      sessions: row.sessions,
      lastDate: hist.at(-1)?.date ?? null,
    };
  }

  /** Ejercicios con series registradas: los prioritarios primero, después por uso reciente. */
  async function list() {
    const prio = await priority();
    const t = await today(db);
    return (await Promise.all((await exercisesWithData())
      .map(async (row) => await summaryOf(row, prio, t))))
      .sort((a, b) => Number(b.priority) - Number(a.priority) || String(b.lastDate).localeCompare(String(a.lastDate)));
  }

  /** Detalle de un ejercicio. */
  async function detail(exerciseId) {
    const row = (await exercisesWithData()).find((r) => r.id === Number(exerciseId));
    if (!row) return null;
    const exercise = toExercise(row);
    const t = await today(db);
    const base = await summaryOf(row, await priority(), t);
    const hist = await history.progress(exercise.id, { isBodyweight: exercise.isBodyweight });
    const recs = await history.records(exercise.id, { isBodyweight: exercise.isBodyweight });
    const bestSet = recs.bestE1rm ? { weightKg: recs.bestE1rm.weightKg, reps: recs.bestE1rm.reps, date: recs.bestE1rm.date } : null;
    // Récord por repeticiones: alrededor del rango que usás (las reps registradas, de menos a más).
    const reps = Object.keys(recs.byReps).map(Number).sort((a, b) => a - b);
    return {
      ...base,
      exercise,
      bestSet,
      byReps: reps.map((r) => ({ reps: r, ...recs.byReps[r] })),
      history: [...hist].reverse().map((h, i, arr) => ({
        date: h.date,
        sessionId: h.sessionId,
        line: setsLine(h.sets, { bodyweight: exercise.isBodyweight }),
        e1rm: h.e1rm,
        // La primera vez no es "récord": no había contra qué comparar.
        record: h.record && i < arr.length - 1,
      })),
      chart: hist.map((h, i) => ({ date: h.date, e1rm: h.e1rm, record: h.record && i > 0 })),
    };
  }

  /** Récords de los últimos días (para el Inicio): el mejor 1RM de esa sesión cuando superó al anterior. */
  async function recent({ days = 21, limit = 5 } = {}) {
    const from = addDays(await today(db), -days);
    const out = [];
    for (const row of await exercisesWithData()) {
      const exercise = toExercise(row);
      const hist = await history.progress(exercise.id, { isBodyweight: exercise.isBodyweight });
      hist.forEach((h, i) => {
        if (i === 0 || !h.record || h.date < from) return;
        const top = h.sets.reduce((best, s) => (!best || (s.weightKg ?? 0) * (1 + s.reps / 30) > (best.weightKg ?? 0) * (1 + best.reps / 30) ? s : best), null);
        out.push({ exerciseId: exercise.id, name: exercise.name, date: h.date, e1rm: h.e1rm, weightKg: top?.weightKg ?? null, reps: top?.reps ?? null, isBodyweight: exercise.isBodyweight });
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  return { list, detail, recent };
}
