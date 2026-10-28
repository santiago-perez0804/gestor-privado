import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
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

async function setup() {
  const db = await testDb();
  const exercises = createExercises(db);
  const history = createHistory(db);
  const plans = createPlans(db, { history });
  const body = createBody(db);
  const workouts = createWorkouts(db, { history, plans, body });
  const ex = async (name) => (await exercises.list({ q: name })).find((e) => e.name === name);
  await db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (91, '2026-10-20T08:00', 'x'), (91, '2026-10-26T08:00', 'x')").run();
  const plan = await plans.create({ name: "PPL" });
  const pull = await plans.createRoutine(plan.id, { name: "Pull A" });
  await plans.addItem(pull.id, { exerciseId: (await ex("Dominadas lastradas")).id, sets: 3, repMin: 5, repMax: 7, restSeconds: 150 });
  await plans.addItem(pull.id, { exerciseId: (await ex("Curl con barra")).id, sets: 3, repMin: 6, repMax: 8, restSeconds: 120 });
  return { db, workouts, plans, pull, ex };
}

let n = 0;
const newId = () => `test-id-${String(++n).padStart(4, "0")}`;

/** Simula un entreno en el celular: empieza, tilda series y lo sube. */
async function playSession(workouts, routineId, { at, edits = {}, finish = true }) {
  const start = await workouts.startData({ routineId });
  let s = initWorkout(start, { now: at, newId });
  for (const set of s.sets) {
    const e = edits[set.exerciseId];
    if (e) s = workoutReducer(s, { type: "edit", setId: set.id, field: "weightKg", value: e.weightKg, now: at });
    if (e?.reps) s = workoutReducer(s, { type: "edit", setId: set.id, field: "reps", value: e.reps.shift(), now: at });
    s = workoutReducer(s, { type: "toggleDone", setId: set.id, now: at + 60_000 });
  }
  if (finish) s = workoutReducer(s, { type: "finish", now: at + 3_600_000 });
  return { state: s, result: await workouts.upsert(s.session.id, toSnapshot(s)) };
}

test("al empezar trae la rutina, el peso del día y sugerencias; entreno libre también", async () => {
  const { workouts, pull } = await setup();
  const start = await workouts.startData({ routineId: pull.id });
  assert.equal(start.session.title, "Pull A");
  assert.equal(start.session.bodyweightKg, 91);
  assert.equal(start.exercises.length, 2);
  assert.equal(start.exercises[0].suggestion.kind, "start");
  assert.equal(start.exercises[1].prescription.restSeconds, 120);
  assert.ok(start.settings.plates && start.settings.bars);
  const free = await workouts.startData({});
  assert.equal(free.session.title, "Entreno libre");
  assert.equal(free.exercises.length, 0);
  await assert.rejects(async () => await workouts.startData({ routineId: 999 }), { message: "routine_not_found" });
});

test("guardar es idempotente y una versión vieja no pisa a la nueva", async () => {
  const { workouts, pull, db } = await setup();
  const at = Date.parse("2026-10-27T21:00:00Z");
  const { state, result } = await playSession(workouts, pull.id, { at, finish: false });
  assert.equal(result.stale, false);
  const snap = toSnapshot(state);
  assert.equal((await workouts.upsert(state.session.id, snap)).session.sets.length, 6, "mandarlo dos veces no duplica");
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM set_logs").get()).n, 6);
  const newer = workoutReducer(state, { type: "removeSet", setId: state.sets[0].id, now: at + 999_999 });
  await workouts.upsert(state.session.id, toSnapshot(newer));
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM set_logs").get()).n, 5, "la serie borrada se borra");
  const late = await workouts.upsert(state.session.id, snap);
  assert.equal(late.stale, true, "un reintento atrasado se ignora");
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM set_logs").get()).n, 5);
  assert.equal((await workouts.inProgress()).id, state.session.id);
  assert.equal((await workouts.inProgress()).setsDone, 5);
  assert.equal((await workouts.get(state.session.id)).localDate, "2026-10-27", "día en Buenos Aires");
});

test("validaciones del snapshot", async () => {
  const { workouts } = await setup();
  const base = { status: "done", startedAt: "2026-10-27T21:00:00Z", updatedAt: "2026-10-27T22:00:00Z", sets: [] };
  await assert.rejects(async () => await workouts.upsert("x", base), { message: "invalid_id" });
  await assert.rejects(async () => await workouts.upsert("sesion-0001", { ...base, status: "volando" }), { message: "invalid_status" });
  await assert.rejects(async () => await workouts.upsert("sesion-0001", { ...base, sets: [{ id: "serie-0001", exerciseId: 99999, type: "working" }] }), { message: "unknown_exercise" });
  await assert.rejects(async () => await workouts.upsert("sesion-0001", { ...base, sets: [{ id: "serie-0001", exerciseId: 1, type: "working", reps: 999 }] }), { message: "invalid_reps" });
});

test("resumen: duración, volumen por músculo, récords y comparación con la vez anterior", async () => {
  const { workouts, pull, ex } = await setup();
  const curl = (await ex("Curl con barra")).id;
  const dom = (await ex("Dominadas lastradas")).id;
  const t1 = Date.parse("2026-10-20T21:00:00Z");
  await playSession(workouts, pull.id, { at: t1, edits: { [curl]: { weightKg: 32.5, reps: [8, 8, 7] }, [dom]: { weightKg: 5, reps: [6, 6, 5] } } });
  const t2 = Date.parse("2026-10-27T21:00:00Z");
  const { state } = await playSession(workouts, pull.id, { at: t2, edits: { [curl]: { weightKg: 32.5, reps: [9, 8, 8] }, [dom]: { weightKg: 5, reps: [7, 6, 6] } } });
  const s = await workouts.summary(state.session.id);
  assert.equal(s.durationMin, 60);
  assert.equal(s.workingSets, 6);
  assert.deepEqual(s.byMuscle, { espalda: 3, biceps: 4.5, antebrazo: 1.5 });
  assert.ok(s.records.some((r) => r.exerciseId === curl && r.e1rm), "curl 32,5 × 9 es récord");
  assert.ok(s.records.some((r) => r.exerciseId === dom && r.bodyweight), "dominadas con lastre también");
  assert.equal(s.comparison.date, "2026-10-20");
  const c = s.comparison.perExercise.find((x) => x.exerciseId === curl);
  assert.ok(c.e1rmNow > c.e1rmBefore);
  // La sugerencia de la próxima ya usa este entreno.
  const next = (await workouts.startData({ routineId: pull.id })).exercises.find((e) => e.exerciseId === curl).suggestion;
  assert.deepEqual([next.kind, next.weightKg], ["increase", 35], "9, 8, 8: todas al tope → sube");
});

test("hoy: la rutina que toca según la agenda y la semana con lo hecho", async () => {
  const { workouts, plans, pull } = await setup();
  const planId = await plans.activeId();
  await plans.setSchedule(planId, [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekday: d, routineId: pull.id })));
  const info = await workouts.todayInfo();
  assert.equal(info.suggestedRoutineId, pull.id, "todos los días Pull A: hoy también");
  assert.equal(info.routines.length, 1);
  const w = await workouts.week();
  assert.equal(w.days.length, 7);
  assert.equal(w.planned, 7);
});

test("récords: lista con 1RM, % en 6 semanas y detalle con historial y récord por reps", async () => {
  const { createRecords } = await import("../src/services/fisico/records.js");
  const { db, workouts, pull, ex, plans } = await setup();
  const records = createRecords(db, { history: createHistory(db), plans });
  const curl = (await ex("Curl con barra")).id;
  const recentDay = (back) => Date.now() - back * 86_400_000;
  await playSession(workouts, pull.id, { at: recentDay(28), edits: { [curl]: { weightKg: 30, reps: [8, 8, 8] } } });
  await playSession(workouts, pull.id, { at: recentDay(14), edits: { [curl]: { weightKg: 30, reps: [9, 8, 8] } } });
  await playSession(workouts, pull.id, { at: recentDay(7), edits: { [curl]: { weightKg: 32.5, reps: [8, 8, 7] } } });
  const list = await records.list();
  const c = list.find((x) => x.exerciseId === curl);
  assert.equal(c.bestE1rm.value, 41.2);
  assert.equal(c.changePct, 8.4, "de 38 a 41,2");
  assert.equal(c.sparkline.length, 3);
  const d = await records.detail(curl);
  assert.equal(d.history.length, 3);
  assert.deepEqual(d.history.map((h) => h.record), [true, true, false], "la primera no cuenta como récord");
  assert.equal(d.history[0].line, "32,5 × 8, 8, 7");
  assert.deepEqual(d.byReps.map((r) => [r.reps, r.weightKg]), [[7, 32.5], [8, 32.5], [9, 30]]);
  assert.equal((await records.recent()).filter((r) => r.exerciseId === curl).length, 2);
  assert.equal(await records.detail(99999), null);
});
