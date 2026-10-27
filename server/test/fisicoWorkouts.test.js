import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { sharedSchema } from "../src/db/schema/shared.js";
import { fisicoSchema } from "../src/db/schema/fisico.js";
import { migrateFisicoV2 } from "../src/db/migrations/fisicoV2.js";
import { createExercises } from "../src/services/fisico/exercises.js";
import { createHistory } from "../src/services/fisico/history.js";
import { createPlans } from "../src/services/fisico/plans.js";
import { createBody } from "../src/services/fisico/body.js";
import { createWorkouts } from "../src/services/fisico/workouts.js";
import { initWorkout, workoutReducer, toSnapshot } from "../../shared/fisico/workout.js";

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(sharedSchema);
  db.exec(fisicoSchema);
  migrateFisicoV2(db);
  const exercises = createExercises(db);
  const history = createHistory(db);
  const plans = createPlans(db, { history });
  const body = createBody(db);
  const workouts = createWorkouts(db, { history, plans, body });
  const ex = (name) => exercises.list({ q: name }).find((e) => e.name === name);
  db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (91, '2026-10-20T08:00', 'x'), (91, '2026-10-26T08:00', 'x')").run();
  const plan = plans.create({ name: "PPL" });
  const pull = plans.createRoutine(plan.id, { name: "Pull A" });
  plans.addItem(pull.id, { exerciseId: ex("Dominadas lastradas").id, sets: 3, repMin: 5, repMax: 7, restSeconds: 150 });
  plans.addItem(pull.id, { exerciseId: ex("Curl con barra").id, sets: 3, repMin: 6, repMax: 8, restSeconds: 120 });
  return { db, workouts, plans, pull, ex };
}

let n = 0;
const newId = () => `test-id-${String(++n).padStart(4, "0")}`;

/** Simula un entreno en el celular: empieza, tilda series y lo sube. */
function playSession(workouts, routineId, { at, edits = {}, finish = true }) {
  const start = workouts.startData({ routineId });
  let s = initWorkout(start, { now: at, newId });
  for (const set of s.sets) {
    const e = edits[set.exerciseId];
    if (e) s = workoutReducer(s, { type: "edit", setId: set.id, field: "weightKg", value: e.weightKg, now: at });
    if (e?.reps) s = workoutReducer(s, { type: "edit", setId: set.id, field: "reps", value: e.reps.shift(), now: at });
    s = workoutReducer(s, { type: "toggleDone", setId: set.id, now: at + 60_000 });
  }
  if (finish) s = workoutReducer(s, { type: "finish", now: at + 3_600_000 });
  return { state: s, result: workouts.upsert(s.session.id, toSnapshot(s)) };
}

test("al empezar trae la rutina, el peso del día y sugerencias; entreno libre también", () => {
  const { workouts, pull } = setup();
  const start = workouts.startData({ routineId: pull.id });
  assert.equal(start.session.title, "Pull A");
  assert.equal(start.session.bodyweightKg, 91);
  assert.equal(start.exercises.length, 2);
  assert.equal(start.exercises[0].suggestion.kind, "start");
  assert.equal(start.exercises[1].prescription.restSeconds, 120);
  assert.ok(start.settings.plates && start.settings.bars);
  const free = workouts.startData({});
  assert.equal(free.session.title, "Entreno libre");
  assert.equal(free.exercises.length, 0);
  assert.throws(() => workouts.startData({ routineId: 999 }), { message: "routine_not_found" });
});

test("guardar es idempotente y una versión vieja no pisa a la nueva", () => {
  const { workouts, pull, db } = setup();
  const at = Date.parse("2026-10-27T21:00:00Z");
  const { state, result } = playSession(workouts, pull.id, { at, finish: false });
  assert.equal(result.stale, false);
  const snap = toSnapshot(state);
  assert.equal(workouts.upsert(state.session.id, snap).session.sets.length, 6, "mandarlo dos veces no duplica");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM set_logs").get().n, 6);
  const newer = workoutReducer(state, { type: "removeSet", setId: state.sets[0].id, now: at + 999_999 });
  workouts.upsert(state.session.id, toSnapshot(newer));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM set_logs").get().n, 5, "la serie borrada se borra");
  const late = workouts.upsert(state.session.id, snap);
  assert.equal(late.stale, true, "un reintento atrasado se ignora");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM set_logs").get().n, 5);
  assert.equal(workouts.inProgress().id, state.session.id);
  assert.equal(workouts.inProgress().setsDone, 5);
  assert.equal(workouts.get(state.session.id).localDate, "2026-10-27", "día en Buenos Aires");
});

test("validaciones del snapshot", () => {
  const { workouts } = setup();
  const base = { status: "done", startedAt: "2026-10-27T21:00:00Z", updatedAt: "2026-10-27T22:00:00Z", sets: [] };
  assert.throws(() => workouts.upsert("x", base), { message: "invalid_id" });
  assert.throws(() => workouts.upsert("sesion-0001", { ...base, status: "volando" }), { message: "invalid_status" });
  assert.throws(() => workouts.upsert("sesion-0001", { ...base, sets: [{ id: "serie-0001", exerciseId: 99999, type: "working" }] }), { message: "unknown_exercise" });
  assert.throws(() => workouts.upsert("sesion-0001", { ...base, sets: [{ id: "serie-0001", exerciseId: 1, type: "working", reps: 999 }] }), { message: "invalid_reps" });
});

test("resumen: duración, volumen por músculo, récords y comparación con la vez anterior", () => {
  const { workouts, pull, ex } = setup();
  const curl = ex("Curl con barra").id;
  const dom = ex("Dominadas lastradas").id;
  const t1 = Date.parse("2026-10-20T21:00:00Z");
  playSession(workouts, pull.id, { at: t1, edits: { [curl]: { weightKg: 32.5, reps: [8, 8, 7] }, [dom]: { weightKg: 5, reps: [6, 6, 5] } } });
  const t2 = Date.parse("2026-10-27T21:00:00Z");
  const { state } = playSession(workouts, pull.id, { at: t2, edits: { [curl]: { weightKg: 32.5, reps: [9, 8, 8] }, [dom]: { weightKg: 5, reps: [7, 6, 6] } } });
  const s = workouts.summary(state.session.id);
  assert.equal(s.durationMin, 60);
  assert.equal(s.workingSets, 6);
  assert.deepEqual(s.byMuscle, { espalda: 3, biceps: 4.5, antebrazo: 1.5 });
  assert.ok(s.records.some((r) => r.exerciseId === curl && r.e1rm), "curl 32,5 × 9 es récord");
  assert.ok(s.records.some((r) => r.exerciseId === dom && r.bodyweight), "dominadas con lastre también");
  assert.equal(s.comparison.date, "2026-10-20");
  const c = s.comparison.perExercise.find((x) => x.exerciseId === curl);
  assert.ok(c.e1rmNow > c.e1rmBefore);
  // La sugerencia de la próxima ya usa este entreno.
  const next = workouts.startData({ routineId: pull.id }).exercises.find((e) => e.exerciseId === curl).suggestion;
  assert.deepEqual([next.kind, next.weightKg], ["increase", 35], "9, 8, 8: todas al tope → sube");
});

test("hoy: la rutina que toca según la agenda y la semana con lo hecho", () => {
  const { workouts, plans, pull } = setup();
  const planId = plans.activeId();
  plans.setSchedule(planId, [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekday: d, routineId: pull.id })));
  const info = workouts.todayInfo();
  assert.equal(info.suggestedRoutineId, pull.id, "todos los días Pull A: hoy también");
  assert.equal(info.routines.length, 1);
  const w = workouts.week();
  assert.equal(w.days.length, 7);
  assert.equal(w.planned, 7);
});
