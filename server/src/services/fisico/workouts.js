// Entrenos: lo que necesita el celular para empezar (rutina, sugerencias, anteriores, récords y peso
// del día), el guardado idempotente por snapshot (la última versión gana), retomar uno en curso y el
// resumen al terminar.
import { SET_TYPES, SESSION_STATUSES } from "../../../../shared/fisico/constants.js";
import { localDate, weekDays } from "../../../../shared/fisico/dates.js";
import { detectRecord, exerciseRecords, setE1rm } from "../../../../shared/fisico/strength.js";
import { doneVolume } from "../../../../shared/fisico/volume.js";
import { weekPlan, nextWorkout } from "../../../../shared/fisico/schedule.js";
import { bad, notFound, nowIso, getSettings, today } from "./common.js";
import { toExercise } from "./exercises.js";

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const isIso = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));
const numOrNull = (v, min, max, field) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`invalid_${field}`);
  return n;
};

export function createWorkouts(db, { history, plans, body }) {
  const exerciseRow = async (id) => toExercise(await db.prepare("SELECT * FROM exercises WHERE id = ?").get(Number(id)));

  /** Datos de un ejercicio para el entreno: anterior, sugerencia y récords. */
  async function exerciseData(exerciseId, prescription = null) {
    const exercise = await exerciseRow(exerciseId);
    if (!exercise) throw bad("unknown_exercise");
    const settings = await getSettings(db);
    const p = prescription ?? { sets: 3, repMin: exercise.isBodyweight ? 6 : 8, repMax: exercise.isBodyweight ? 10 : 12, restSeconds: exercise.equipment === "barra" ? 150 : 90, rirMin: null, rirMax: null };
    return {
      exerciseId: exercise.id,
      exercise,
      prescription: p,
      previous: await history.last(exercise.id),
      suggestion: await history.suggestion({ exerciseId: exercise.id, sets: p.sets, repMin: p.repMin, repMax: p.repMax }, exercise, settings),
      records: await history.records(exercise.id, { isBodyweight: exercise.isBodyweight }),
    };
  }

  /** Todo lo que el celular necesita para empezar (y seguir sin conexión). Sin rutina = entreno libre. */
  async function startData({ routineId } = {}) {
    const settings = await getSettings(db);
    let routine = null;
    if (routineId) {
      routine = await db.prepare("SELECT id, planId, name FROM routines WHERE id = ?").get(Number(routineId));
      if (!routine) throw notFound("routine_not_found");
    }
    const items = routine ? await db.prepare("SELECT * FROM routine_exercises WHERE routineId = ? ORDER BY sortOrder, id").all(routine.id) : [];
    return {
      session: { routineId: routine?.id ?? null, planId: routine?.planId ?? await plans.activeId(), title: routine?.name ?? "Entreno libre", bodyweightKg: await body.trendOn() },
      priorityMuscles: await (async () => {
        const pid = routine?.planId ?? await plans.activeId();
        return pid ? (await plans.detail(pid)).priorityMuscles : [];
      })(),
      exercises: (await Promise.all(items.map(async (it) =>
        await exerciseData(it.exerciseId, { sets: it.sets, repMin: it.repMin, repMax: it.repMax, restSeconds: it.restSeconds, rirMin: it.rirMin, rirMax: it.rirMax, supersetGroup: it.supersetGroup, notes: it.notes })
      ))),
      settings: { warmupRestSeconds: settings.warmupRestSeconds, bars: settings.bars, plates: settings.plates, progressionStepKg: settings.progressionStepKg, timeZone: settings.timeZone },
    };
  }

  /** Sesiones terminadas de una semana (para la agenda). */
  const doneBetween = async (from, to) => await db.prepare("SELECT id, localDate, routineId FROM workout_sessions WHERE status = 'done' AND localDate BETWEEN ? AND ? ORDER BY startedAt").all(from, to);

  /** La semana del plan activo (estados, reprogramación) y qué entreno toca. */
  async function week(day) {
    day ??= await today(db);
    const id = await plans.activeId();
    if (!id) return null;
    const schedule = Object.fromEntries((await plans.schedule(id)).map((d) => [d.weekday, d]));
    const days = weekDays(day);
    const plan = weekPlan({ days, schedule, sessions: await doneBetween(days[0], days[6]), today: day });
    return { planId: id, ...plan, next: nextWorkout(plan) };
  }

  /** Para "Empezar entreno": la rutina que toca hoy, las demás y si hay uno en curso. */
  async function todayInfo() {
    const id = await plans.activeId();
    const routines = id
      ? await db
          .prepare("SELECT r.id, r.name, (SELECT COUNT(*) FROM routine_exercises x WHERE x.routineId = r.id) AS exerciseCount FROM routines r WHERE r.planId = ? ORDER BY r.sortOrder, r.id")
          .all(id)
      : [];
    const w = await week();
    const t = await today(db);
    const todayDay = w?.days.find((d) => d.date === t);
    return {
      planId: id,
      routines,
      suggestedRoutineId: todayDay?.status === "today" ? todayDay.routineId : null,
      next: w?.next ?? null,
      doneToday: !!todayDay?.doneRoutineIds?.length,
      inProgress: await inProgressSummary(),
    };
  }

  // ---------- guardar (snapshot idempotente) ----------
  async function cleanSnapshot(id, snap) {
    if (!ID.test(id)) throw bad("invalid_id");
    if (!SESSION_STATUSES.includes(snap.status)) throw bad("invalid_status");
    if (!isIso(snap.startedAt)) throw bad("invalid_startedAt");
    if (snap.endedAt != null && !isIso(snap.endedAt)) throw bad("invalid_endedAt");
    if (!isIso(snap.updatedAt)) throw bad("invalid_updatedAt");
    if (!Array.isArray(snap.sets) || snap.sets.length > 400) throw bad("invalid_sets");
    const known = new Set((await db.prepare("SELECT id FROM exercises").all()).map((r) => r.id));
    const sets = snap.sets.map((s) => {
      if (!ID.test(String(s.id))) throw bad("invalid_set_id");
      if (!known.has(Number(s.exerciseId))) throw bad("unknown_exercise");
      if (!SET_TYPES.includes(s.type)) throw bad("invalid_set_type");
      if (s.completedAt != null && !isIso(s.completedAt)) throw bad("invalid_completedAt");
      const reps = numOrNull(s.reps, 0, 200, "reps");
      return {
        id: String(s.id),
        exerciseId: Number(s.exerciseId),
        exerciseOrder: Number(s.exerciseOrder) || 0,
        setOrder: Number(s.setOrder) || 0,
        type: s.type,
        weightKg: numOrNull(s.weightKg, -200, 1000, "weightKg"),
        reps: reps == null ? null : Math.round(reps),
        rir: numOrNull(s.rir, 0, 10, "rir"),
        completedAt: s.completedAt ?? null,
      };
    });
    const routineId = snap.routineId && await db.prepare("SELECT id FROM routines WHERE id = ?").get(Number(snap.routineId)) ? Number(snap.routineId) : null;
    const planId = snap.planId && await db.prepare("SELECT id FROM plans WHERE id = ?").get(Number(snap.planId)) ? Number(snap.planId) : null;
    const bw = numOrNull(snap.bodyweightKg, 20, 400, "bodyweightKg");
    return { routineId, planId, title: String(snap.title || "Entreno").slice(0, 120), status: snap.status, startedAt: snap.startedAt, endedAt: snap.endedAt ?? null, bodyweightKg: bw, notes: snap.notes ? String(snap.notes).slice(0, 2000) : null, updatedAt: snap.updatedAt, sets };
  }

  /**
   * Guarda el estado completo de un entreno. Idempotente: mandar lo mismo dos veces no cambia nada, y
   * si llega una versión más vieja que la guardada (reintento atrasado), se ignora.
   */
  async function upsert(id, snap) {
    const s = await cleanSnapshot(id, snap || {});
    const existing = await db.prepare("SELECT updatedAt FROM workout_sessions WHERE id = ?").get(id);
    if (existing && existing.updatedAt > s.updatedAt) return { stale: true, session: await get(id) };
    const day = localDate(new Date(s.startedAt), (await getSettings(db)).timeZone);
    const ts = nowIso();
    await db.tx(async () => {
      await db.prepare(
        `INSERT INTO workout_sessions (id, planId, routineId, title, startedAt, endedAt, status, localDate, bodyweightKg, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET planId = excluded.planId, routineId = excluded.routineId, title = excluded.title, startedAt = excluded.startedAt,
           endedAt = excluded.endedAt, status = excluded.status, localDate = excluded.localDate, bodyweightKg = excluded.bodyweightKg, notes = excluded.notes, updatedAt = excluded.updatedAt`
      ).run(id, s.planId, s.routineId, s.title, s.startedAt, s.endedAt, s.status, day, s.bodyweightKg, s.notes, ts, s.updatedAt);
      const keep = new Set(s.sets.map((x) => x.id));
      for (const old of await db.prepare("SELECT id FROM set_logs WHERE sessionId = ?").all(id)) if (!keep.has(old.id)) await db.prepare("DELETE FROM set_logs WHERE id = ?").run(old.id);
      const up = db.prepare(
        `INSERT INTO set_logs (id, sessionId, exerciseId, exerciseOrder, setOrder, type, weightKg, reps, rir, completedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET exerciseId = excluded.exerciseId, exerciseOrder = excluded.exerciseOrder, setOrder = excluded.setOrder, type = excluded.type,
           weightKg = excluded.weightKg, reps = excluded.reps, rir = excluded.rir, completedAt = excluded.completedAt, updatedAt = excluded.updatedAt
         WHERE set_logs.sessionId = excluded.sessionId`
      );
      for (const x of s.sets) await up.run(x.id, id, x.exerciseId, x.exerciseOrder, x.setOrder, x.type, x.weightKg, x.reps, x.rir, x.completedAt, s.updatedAt);
    });
    return { stale: false, session: await get(id) };
  }

  async function get(id) {
    const s = await db.prepare("SELECT * FROM workout_sessions WHERE id = ?").get(String(id));
    if (!s) throw notFound();
    const sets = await db.prepare("SELECT * FROM set_logs WHERE sessionId = ? ORDER BY exerciseOrder, setOrder").all(s.id);
    return { ...s, sets };
  }

  async function inProgressSummary() {
    const s = await db.prepare("SELECT id, title, startedAt, updatedAt, routineId FROM workout_sessions WHERE status = 'in_progress' ORDER BY updatedAt DESC LIMIT 1").get();
    if (!s) return null;
    const c = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN completedAt IS NOT NULL THEN 1 ELSE 0 END) AS done FROM set_logs WHERE sessionId = ? AND type != 'warmup'").get(s.id);
    return { ...s, setsDone: c.done || 0, setsTotal: c.total || 0 };
  }

  /** Entrenos de un rango (historial). */
  async function list({ from, to } = {}) {
    return await db
      .prepare(
        `SELECT s.id, s.title, s.localDate, s.startedAt, s.endedAt, s.status, s.routineId,
           (SELECT COUNT(*) FROM set_logs l WHERE l.sessionId = s.id AND l.type = 'working' AND l.completedAt IS NOT NULL) AS workingSets
         FROM workout_sessions s WHERE s.status = 'done' AND s.localDate BETWEEN ? AND ? ORDER BY s.startedAt DESC`
      )
      .all(from || "0000-01-01", to || "9999-12-31");
  }

  /** Resumen al terminar: duración, series, volumen, por músculo, récords y comparación con la vez anterior. */
  async function summary(id) {
    const s = await get(id);
    const exercises = new Map((await db.prepare("SELECT * FROM exercises").all()).map((r) => [r.id, toExercise(r)]));
    const working = s.sets.filter((x) => x.type === "working" && x.completedAt && x.reps > 0);
    const volumeKg = Math.round(working.reduce((acc, x) => acc + (x.weightKg || 0) * x.reps, 0));
    const durationMin = s.endedAt ? Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000) : null;

    // Récords: cada serie contra lo anterior a esta sesión más lo ya hecho en ella.
    const records = [];
    for (const [exerciseId, sets] of groupBy(working, (x) => x.exerciseId)) {
      const ex = exercises.get(exerciseId);
      const before = await history.records(exerciseId, { isBodyweight: ex?.isBodyweight, exceptSessionId: s.id });
      const seen = [];
      for (const x of sets) {
        const base = mergeRecords(before, exerciseRecords(seen, { isBodyweight: ex?.isBodyweight }));
        const hit = detectRecord(x, base, { isBodyweight: ex?.isBodyweight, bodyweightKg: s.bodyweightKg });
        if (hit.e1rm || hit.reps) records.push({ exerciseId, name: ex?.name, weightKg: x.weightKg, reps: x.reps, e1rm: hit.e1rm, repsRecord: hit.reps, e1rmValue: hit.e1rmValue, bodyweight: !!ex?.isBodyweight });
        seen.push({ weightKg: x.weightKg ?? 0, reps: x.reps, date: s.localDate, bodyweightKg: s.bodyweightKg });
      }
    }

    // Comparación con la última vez que hiciste esta rutina.
    let comparison = null;
    const prev = s.routineId
      ? await db.prepare("SELECT id FROM workout_sessions WHERE routineId = ? AND status = 'done' AND id != ? AND startedAt < ? ORDER BY startedAt DESC LIMIT 1").get(s.routineId, s.id, s.startedAt)
      : null;
    if (prev) {
      const p = await get(prev.id);
      const pw = p.sets.filter((x) => x.type === "working" && x.completedAt && x.reps > 0);
      const best = (sets, exerciseId, ex, bodyweightKg) => Math.max(...sets.filter((x) => x.exerciseId === exerciseId).map((x) => setE1rm(x, { isBodyweight: ex?.isBodyweight, bodyweightKg })?.value ?? -Infinity));
      comparison = {
        date: p.localDate,
        durationMin: p.endedAt ? Math.round((Date.parse(p.endedAt) - Date.parse(p.startedAt)) / 60000) : null,
        workingSets: pw.length,
        volumeKg: Math.round(pw.reduce((acc, x) => acc + (x.weightKg || 0) * x.reps, 0)),
        perExercise: [...new Set(working.map((x) => x.exerciseId))].map((exerciseId) => {
          const ex = exercises.get(exerciseId);
          const now = best(working, exerciseId, ex, s.bodyweightKg);
          const before = best(pw, exerciseId, ex, p.bodyweightKg);
          return { exerciseId, name: ex?.name, e1rmNow: Number.isFinite(now) ? now : null, e1rmBefore: Number.isFinite(before) ? before : null };
        }),
      };
    }

    return {
      id: s.id,
      title: s.title,
      status: s.status,
      localDate: s.localDate,
      durationMin,
      workingSets: working.length,
      plannedSets: s.sets.filter((x) => x.type !== "warmup").length,
      volumeKg,
      byMuscle: doneVolume(s.sets, exercises),
      records,
      comparison,
    };
  }

  return { startData, exerciseData, todayInfo, week, upsert, get, inProgress: inProgressSummary, list, summary };
}

function groupBy(list, key) {
  const m = new Map();
  for (const x of list) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function mergeRecords(a, b) {
  const bestE1rm = !a.bestE1rm || (b.bestE1rm && b.bestE1rm.value > a.bestE1rm.value) ? b.bestE1rm ?? a.bestE1rm : a.bestE1rm;
  const byReps = { ...a.byReps };
  for (const [r, v] of Object.entries(b.byReps || {})) if (!byReps[r] || v.weightKg > byReps[r].weightKg) byReps[r] = v;
  return { bestE1rm, byReps };
}
