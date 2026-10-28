// Planes, rutinas, ejercicios de cada rutina y agenda semanal. La vista del plan trae además el
// volumen planificado por músculo, lo de la última vez y la sugerencia para la próxima.
import { MUSCLE_IDS, EXTRA_ACTIVITIES } from "../../../../shared/fisico/constants.js";
import { daysBetween } from "../../../../shared/fisico/dates.js";
import { plannedVolume, routineVolume, weeklyVolume, shortMuscles } from "../../../../shared/fisico/volume.js";
import { bad, notFound, nowIso, parseJson, getSettings, today } from "./common.js";
import { toExercise } from "./exercises.js";

const int = (v, { min, max, field }) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`invalid_${field}`);
  return n;
};
const optInt = (v, opts) => (v == null || v === "" ? null : int(v, opts));
const optNum = (v, { min, max, field }) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`invalid_${field}`);
  return n;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createPlans(db, { history }) {
  const toPlan = (r) =>
    r && {
      id: r.id,
      name: r.name,
      description: r.description,
      goal: r.goal,
      startDate: r.startDate,
      weeks: r.weeks,
      deloadWeek: r.deloadWeek,
      progressionRule: r.progressionRule,
      priorityMuscles: parseJson(r.priorityMuscles, []),
      dailyExtras: parseJson(r.dailyExtras, []),
      isActive: !!r.isActive,
      createdAt: r.createdAt,
    };

  const getRow = async (id) => {
    const r = await db.prepare("SELECT * FROM plans WHERE id = ?").get(Number(id));
    if (!r) throw notFound();
    return r;
  };

  async function list() {
    return (await db
      .prepare("SELECT p.*, (SELECT COUNT(*) FROM routines r WHERE r.planId = p.id) AS routineCount FROM plans p ORDER BY p.isActive DESC, p.createdAt DESC")
      .all())
      .map((r) => ({ ...toPlan(r), routineCount: r.routineCount }));
  }

  const activeId = async () => (await db.prepare("SELECT id FROM plans WHERE isActive = 1 ORDER BY id LIMIT 1").get())?.id ?? null;

  function cleanPlan(input, current = {}) {
    const name = String(input.name ?? current.name ?? "").trim();
    if (!name) throw bad("name_required");
    const startDate = input.startDate !== undefined ? input.startDate || null : current.startDate ?? null;
    if (startDate && !DATE.test(startDate)) throw bad("invalid_startDate");
    const weeks = input.weeks !== undefined ? optInt(input.weeks, { min: 1, max: 104, field: "weeks" }) : current.weeks ?? null;
    const deloadWeek = input.deloadWeek !== undefined ? optInt(input.deloadWeek, { min: 1, max: 104, field: "deloadWeek" }) : current.deloadWeek ?? null;
    if (weeks && deloadWeek && deloadWeek > weeks) throw bad("deload_after_end");
    const priority = input.priorityMuscles ?? current.priorityMuscles ?? [];
    if (!Array.isArray(priority) || priority.some((m) => !MUSCLE_IDS.includes(m))) throw bad("invalid_priorityMuscles");
    const extras = input.dailyExtras ?? current.dailyExtras ?? [];
    if (!Array.isArray(extras)) throw bad("invalid_dailyExtras");
    return {
      name,
      description: (input.description !== undefined ? input.description : current.description) || null,
      goal: (input.goal !== undefined ? input.goal : current.goal) || null,
      startDate,
      weeks,
      deloadWeek,
      progressionRule: "double_progression",
      priorityMuscles: JSON.stringify([...new Set(priority)]),
      dailyExtras: JSON.stringify([...new Set(extras.map((x) => String(x).trim().toLowerCase()).filter(Boolean))]),
    };
  }

  async function create(input) {
    const p = cleanPlan(input);
    const ts = nowIso();
    const first = !await activeId();
    const id = (await db
      .prepare(
        `INSERT INTO plans (name, description, goal, startDate, weeks, deloadWeek, progressionRule, priorityMuscles, dailyExtras, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(p.name, p.description, p.goal, p.startDate, p.weeks, p.deloadWeek, p.progressionRule, p.priorityMuscles, p.dailyExtras, first ? 1 : 0, ts, ts)).lastInsertRowid;
    await ensureSchedule(id);
    return await detail(id);
  }

  async function update(id, input) {
    const current = toPlan(await getRow(id));
    const p = cleanPlan(input, current);
    await db.prepare(
      "UPDATE plans SET name = ?, description = ?, goal = ?, startDate = ?, weeks = ?, deloadWeek = ?, progressionRule = ?, priorityMuscles = ?, dailyExtras = ?, updatedAt = ? WHERE id = ?"
    ).run(p.name, p.description, p.goal, p.startDate, p.weeks, p.deloadWeek, p.progressionRule, p.priorityMuscles, p.dailyExtras, nowIso(), current.id);
    if (input.isActive === true) await activate(current.id);
    return await detail(current.id);
  }

  /** Un solo plan activo a la vez. */
  async function activate(id) {
    await getRow(id);
    await db.tx(async () => {
      await db.prepare("UPDATE plans SET isActive = 0 WHERE isActive = 1").run();
      await db.prepare("UPDATE plans SET isActive = 1, updatedAt = ? WHERE id = ?").run(nowIso(), Number(id));
    });
  }

  async function remove(id) {
    const row = await getRow(id);
    await db.prepare("DELETE FROM plans WHERE id = ?").run(row.id);
    if (row.isActive) {
      const next = await db.prepare("SELECT id FROM plans ORDER BY createdAt DESC LIMIT 1").get();
      if (next) await db.prepare("UPDATE plans SET isActive = 1 WHERE id = ?").run(next.id);
    }
  }

  /** Duplicar para arrancar un bloque nuevo: copia rutinas, ejercicios y agenda (sin historial). */
  async function duplicate(id, { name, startDate = null, activate: makeActive = false } = {}) {
    const src = toPlan(await getRow(id));
    const ts = nowIso();
    return await db.tx(async () => {
      const newId = Number(
        (await db
          .prepare(
            `INSERT INTO plans (name, description, goal, startDate, weeks, deloadWeek, progressionRule, priorityMuscles, dailyExtras, isActive, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .run((name || `${src.name} (copia)`).trim(), src.description, src.goal, startDate, src.weeks, src.deloadWeek, src.progressionRule, JSON.stringify(src.priorityMuscles), JSON.stringify(src.dailyExtras), ts, ts)).lastInsertRowid
      );
      const routineMap = new Map();
      for (const r of await db.prepare("SELECT * FROM routines WHERE planId = ? ORDER BY sortOrder, id").all(src.id)) {
        const rid = Number((await db.prepare("INSERT INTO routines (planId, name, description, icon, color, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(newId, r.name, r.description, r.icon, r.color, r.sortOrder, ts, ts)).lastInsertRowid);
        routineMap.set(r.id, rid);
        for (const it of await db.prepare("SELECT * FROM routine_exercises WHERE routineId = ? ORDER BY sortOrder, id").all(r.id)) {
          await db.prepare(
            `INSERT INTO routine_exercises (routineId, exerciseId, sortOrder, sets, repMin, repMax, restSeconds, rirMin, rirMax, supersetGroup, notes, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(rid, it.exerciseId, it.sortOrder, it.sets, it.repMin, it.repMax, it.restSeconds, it.rirMin, it.rirMax, it.supersetGroup, it.notes, ts, ts);
        }
      }
      for (const d of await db.prepare("SELECT * FROM plan_schedule WHERE planId = ?").all(src.id)) {
        await db.prepare("INSERT INTO plan_schedule (planId, weekday, routineId, extras) VALUES (?, ?, ?, ?)").run(newId, d.weekday, d.routineId ? routineMap.get(d.routineId) ?? null : null, d.extras);
      }
      await ensureSchedule(newId);
      if (makeActive) await activate(newId);
      return await detail(newId);
    });
  }

  // ---------- agenda ----------
  async function ensureSchedule(planId) {
    const ins = db.prepare("INSERT OR IGNORE INTO plan_schedule (planId, weekday, routineId, extras) VALUES (?, ?, NULL, '[]')");
    for (let d = 1; d <= 7; d++) await ins.run(planId, d);
  }

  async function schedule(planId) {
    await ensureSchedule(planId);
    return (await db
      .prepare("SELECT weekday, routineId, extras FROM plan_schedule WHERE planId = ? ORDER BY weekday")
      .all(planId))
      .map((d) => ({ weekday: d.weekday, routineId: d.routineId, extras: parseJson(d.extras, []) }));
  }

  /** Agenda: [{ weekday 1–7, routineId | null, extras: [] }]. Solo rutinas del mismo plan. */
  async function setSchedule(planId, days) {
    await getRow(planId);
    if (!Array.isArray(days)) throw bad("invalid_schedule");
    const routineIds = new Set((await db.prepare("SELECT id FROM routines WHERE planId = ?").all(planId)).map((r) => r.id));
    const up = db.prepare(
      "INSERT INTO plan_schedule (planId, weekday, routineId, extras) VALUES (?, ?, ?, ?) ON CONFLICT(planId, weekday) DO UPDATE SET routineId = excluded.routineId, extras = excluded.extras"
    );
    for (const d of days) {
      const weekday = int(d.weekday, { min: 1, max: 7, field: "weekday" });
      const rid = d.routineId == null || d.routineId === "" ? null : Number(d.routineId);
      if (rid != null && !routineIds.has(rid)) throw bad("routine_not_in_plan");
      const extras = [...new Set((d.extras || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 6);
      await up.run(planId, weekday, rid, JSON.stringify(extras));
    }
    return await schedule(planId);
  }

  // ---------- rutinas ----------
  const getRoutine = async (id) => {
    const r = await db.prepare("SELECT * FROM routines WHERE id = ?").get(Number(id));
    if (!r) throw notFound();
    return r;
  };

  async function createRoutine(planId, { name, description, color }) {
    await getRow(planId);
    if (!String(name || "").trim()) throw bad("name_required");
    const ts = nowIso();
    const order = (await db.prepare("SELECT COALESCE(MAX(sortOrder), -1) + 1 AS n FROM routines WHERE planId = ?").get(planId)).n;
    const id = (await db.prepare("INSERT INTO routines (planId, name, description, color, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(planId, name.trim(), description || null, color || null, order, ts, ts)).lastInsertRowid;
    return await routine(id);
  }

  async function updateRoutine(id, input) {
    const r = await getRoutine(id);
    const name = String(input.name ?? r.name).trim();
    if (!name) throw bad("name_required");
    await db.prepare("UPDATE routines SET name = ?, description = ?, color = ?, updatedAt = ? WHERE id = ?").run(
      name,
      input.description !== undefined ? input.description || null : r.description,
      input.color !== undefined ? input.color || null : r.color,
      nowIso(),
      r.id
    );
    return await routine(r.id);
  }

  const deleteRoutine = async (id) => await db.prepare("DELETE FROM routines WHERE id = ?").run((await getRoutine(id)).id);

  /** Reordenar: la lista completa de ids en el orden nuevo. */
  async function reorder(table, parentCol, parentId, ids) {
    const current = (await db.prepare(`SELECT id FROM ${table} WHERE ${parentCol} = ?`).all(parentId)).map((r) => r.id);
    if (!Array.isArray(ids) || ids.length !== current.length || ids.some((id) => !current.includes(Number(id)))) throw bad("invalid_order");
    const up = db.prepare(`UPDATE ${table} SET sortOrder = ? WHERE id = ?`);
    for (const [i, id] of ids.entries()) await up.run(i, Number(id));
  }

  const reorderRoutines = async (planId, ids) => (await reorder("routines", "planId", Number(planId), ids), await routinesOf(planId));

  // ---------- ejercicios de rutina ----------
  function cleanItem(input, current = {}) {
    const pick = (k) => (input[k] !== undefined ? input[k] : current[k]);
    const sets = int(pick("sets") ?? 3, { min: 1, max: 20, field: "sets" });
    const repMin = int(pick("repMin") ?? 8, { min: 1, max: 100, field: "repMin" });
    const repMax = int(pick("repMax") ?? Math.max(repMin, 12), { min: 1, max: 100, field: "repMax" });
    if (repMax < repMin) throw bad("repMax_below_repMin");
    const restSeconds = int(pick("restSeconds") ?? 120, { min: 0, max: 1800, field: "restSeconds" });
    const rirMin = optNum(pick("rirMin"), { min: 0, max: 10, field: "rirMin" });
    const rirMax = optNum(pick("rirMax"), { min: 0, max: 10, field: "rirMax" });
    if (rirMin != null && rirMax != null && rirMax < rirMin) throw bad("rirMax_below_rirMin");
    return { sets, repMin, repMax, restSeconds, rirMin, rirMax, supersetGroup: pick("supersetGroup") || null, notes: pick("notes") || null };
  }

  async function addItem(routineId, input) {
    const r = await getRoutine(routineId);
    const ex = await db.prepare("SELECT id, archived FROM exercises WHERE id = ?").get(Number(input.exerciseId));
    if (!ex) throw bad("unknown_exercise");
    const it = cleanItem(input);
    const ts = nowIso();
    const order = (await db.prepare("SELECT COALESCE(MAX(sortOrder), -1) + 1 AS n FROM routine_exercises WHERE routineId = ?").get(r.id)).n;
    await db.prepare(
      `INSERT INTO routine_exercises (routineId, exerciseId, sortOrder, sets, repMin, repMax, restSeconds, rirMin, rirMax, supersetGroup, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(r.id, ex.id, order, it.sets, it.repMin, it.repMax, it.restSeconds, it.rirMin, it.rirMax, it.supersetGroup, it.notes, ts, ts);
    return await routine(r.id);
  }

  async function updateItem(itemId, input) {
    const cur = await db.prepare("SELECT * FROM routine_exercises WHERE id = ?").get(Number(itemId));
    if (!cur) throw notFound();
    const it = cleanItem(input, cur);
    let exerciseId = cur.exerciseId;
    if (input.exerciseId !== undefined && Number(input.exerciseId) !== cur.exerciseId) {
      if (!await db.prepare("SELECT 1 FROM exercises WHERE id = ?").get(Number(input.exerciseId))) throw bad("unknown_exercise");
      exerciseId = Number(input.exerciseId);
    }
    await db.prepare(
      "UPDATE routine_exercises SET exerciseId = ?, sets = ?, repMin = ?, repMax = ?, restSeconds = ?, rirMin = ?, rirMax = ?, supersetGroup = ?, notes = ?, updatedAt = ? WHERE id = ?"
    ).run(exerciseId, it.sets, it.repMin, it.repMax, it.restSeconds, it.rirMin, it.rirMax, it.supersetGroup, it.notes, nowIso(), cur.id);
    return await routine(cur.routineId);
  }

  async function removeItem(itemId) {
    const cur = await db.prepare("SELECT routineId FROM routine_exercises WHERE id = ?").get(Number(itemId));
    if (!cur) throw notFound();
    await db.prepare("DELETE FROM routine_exercises WHERE id = ?").run(Number(itemId));
    return await routine(cur.routineId);
  }

  const reorderItems = async (routineId, ids) => (await reorder("routine_exercises", "routineId", Number(routineId), ids), await routine(routineId));

  // ---------- lecturas ----------
  const exercisesById = async () => new Map((await db.prepare("SELECT * FROM exercises").all()).map((r) => [r.id, toExercise(r)]));
  const itemsOf = async (routineId) => await db.prepare("SELECT * FROM routine_exercises WHERE routineId = ? ORDER BY sortOrder, id").all(routineId);

  /** Una rutina con sus ejercicios, lo de la última vez y la próxima sugerencia. */
  async function routine(id, ctx = {}) {
    const exercises = ctx.exercises ?? await exercisesById();
    const settings = ctx.settings ?? await getSettings(db);
    const r = await getRoutine(id);
    const items = (await Promise.all((await itemsOf(r.id)).map(async (it) => {
      const exercise = exercises.get(it.exerciseId);
      const last = await history.last(it.exerciseId);
      return {
        id: it.id,
        exerciseId: it.exerciseId,
        exercise,
        sortOrder: it.sortOrder,
        sets: it.sets,
        repMin: it.repMin,
        repMax: it.repMax,
        restSeconds: it.restSeconds,
        rirMin: it.rirMin,
        rirMax: it.rirMax,
        supersetGroup: it.supersetGroup,
        notes: it.notes,
        last: last && { date: last.date, sets: last.sets.filter((s) => s.type === "working") },
        next: await history.suggestion(it, exercise, settings),
      };
    })));
    const volume = routineVolume(items, exercises);
    return {
      id: r.id,
      planId: r.planId,
      name: r.name,
      description: r.description,
      color: r.color,
      sortOrder: r.sortOrder,
      items,
      exerciseCount: items.length,
      setCount: items.reduce((s, x) => s + x.sets, 0),
      volume,
      estimatedMinutes: Math.round(items.reduce((s, x) => s + x.sets * (x.restSeconds + 45), 0) / 60),
    };
  }

  async function routinesOf(planId, ctx) {
    return (await Promise.all((await db
      .prepare("SELECT id FROM routines WHERE planId = ? ORDER BY sortOrder, id")
      .all(Number(planId)))
      .map(async (r) => await routine(r.id, ctx))));
  }

  /** El plan completo: datos, agenda, rutinas y volumen semanal planificado. */
  async function detail(id) {
    const plan = toPlan(await getRow(id));
    const exercises = await exercisesById();
    const settings = await getSettings(db);
    const ctx = { exercises, settings };
    const routines = await routinesOf(plan.id, ctx);
    const sched = await schedule(plan.id);
    const routineItems = new Map(routines.map((r) => [r.id, r.items]));
    const planned = plannedVolume(
      sched.map((d) => d.routineId),
      routineItems,
      exercises
    );
    const rows = weeklyVolume({ planned, range: settings.volumeRange, priorityMuscles: plan.priorityMuscles });
    const t = await today(db);
    const week = plan.startDate && t >= plan.startDate ? Math.floor(daysBetween(plan.startDate, t) / 7) + 1 : null;
    return {
      ...plan,
      currentWeek: week,
      isDeloadWeek: !!(week && plan.deloadWeek && week === plan.deloadWeek),
      schedule: sched,
      routines,
      weeklyVolume: rows,
      shortMuscles: shortMuscles(rows, { min: settings.volumeRange.min }),
      extraActivities: EXTRA_ACTIVITIES,
    };
  }

  return { list, activeId, detail, create, update, activate, remove, duplicate, schedule, setSchedule, routine, createRoutine, updateRoutine, deleteRoutine, reorderRoutines, addItem, updateItem, removeItem, reorderItems };
}
