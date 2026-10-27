// Historial de entrenos por ejercicio: series anteriores, récords y sugerencia de la próxima sesión.
// Lee la base y delega todos los cálculos en shared/fisico (puros).
import { exerciseRecords, e1rmHistory } from "../../../../shared/fisico/strength.js";
import { suggestNext } from "../../../../shared/fisico/progression.js";

export function createHistory(db) {
  const setsOf = db.prepare(
    `SELECT s.id AS sessionId, s.localDate AS date, s.bodyweightKg, l.type, l.weightKg, l.reps, l.rir, l.setOrder, l.completedAt
     FROM set_logs l JOIN workout_sessions s ON s.id = l.sessionId
     WHERE l.exerciseId = ? AND s.status = 'done' AND l.completedAt IS NOT NULL AND l.reps > 0
     ORDER BY s.startedAt DESC, l.setOrder ASC`
  );

  /** Sesiones terminadas con ese ejercicio, la más reciente primero (todas las series completadas). */
  function sessions(exerciseId, { limit = Infinity, exceptSessionId = null } = {}) {
    const out = [];
    let cur = null;
    for (const r of setsOf.iterate(exerciseId)) {
      if (r.sessionId === exceptSessionId) continue;
      if (!cur || cur.sessionId !== r.sessionId) {
        if (out.length >= limit) break;
        cur = { sessionId: r.sessionId, date: r.date, bodyweightKg: r.bodyweightKg, sets: [] };
        out.push(cur);
      }
      cur.sets.push({ type: r.type, weightKg: r.weightKg ?? 0, reps: r.reps, rir: r.rir, setOrder: r.setOrder, bodyweightKg: r.bodyweightKg });
    }
    return out;
  }

  const working = (s) => s.sets.filter((x) => x.type === "working");

  /** Lo que hiciste la última vez (todas las series en orden: la columna "Anterior"). */
  const last = (exerciseId, opts) => sessions(exerciseId, { limit: 1, ...opts })[0] ?? null;

  /** Récords del ejercicio (mejor 1RM estimado y mejor peso por reps). */
  function records(exerciseId, { isBodyweight = false, exceptSessionId = null } = {}) {
    const flat = sessions(exerciseId, { exceptSessionId }).flatMap((s) => working(s).map((x) => ({ ...x, date: s.date, sessionId: s.sessionId })));
    return exerciseRecords(flat, { isBodyweight });
  }

  /** Evolución sesión por sesión (para Récords): 1RM estimado del día y si fue récord. */
  function progress(exerciseId, { isBodyweight = false } = {}) {
    return e1rmHistory(
      sessions(exerciseId).map((s) => ({ date: s.date, sessionId: s.sessionId, sets: working(s) })),
      { isBodyweight }
    );
  }

  /** Sugerencia para la próxima vez (doble progresión con el paso del equipo). */
  function suggestion(item, exercise, settings, opts) {
    const hist = sessions(item.exerciseId, { limit: 3, ...opts }).map((s) => ({ date: s.date, sets: working(s) }));
    const stepKg = settings.progressionStepKg?.[exercise?.equipment] ?? 2.5;
    return suggestNext({ sets: item.sets, repMin: item.repMin, repMax: item.repMax }, hist, { stepKg });
  }

  return { sessions, last, records, progress, suggestion };
}
