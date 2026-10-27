import { test } from "node:test";
import assert from "node:assert/strict";
import { initWorkout, workoutReducer as r, toSnapshot, progress, restRemaining, isDirty, platesFor } from "../fisico/workout.js";
import { exerciseRecords } from "../fisico/strength.js";

let n = 0;
const newId = () => `id${++n}`;
const T0 = Date.parse("2026-10-27T21:00:00Z");

const curl = { exerciseId: 5, exercise: { name: "Curl con barra", equipment: "barra", bar: "z", isBodyweight: false }, prescription: { sets: 3, repMin: 6, repMax: 8, restSeconds: 120 }, previous: { date: "2026-10-20", sets: [{ type: "warmup", weightKg: 20, reps: 10 }, { type: "working", weightKg: 32.5, reps: 8 }, { type: "working", weightKg: 32.5, reps: 8 }, { type: "working", weightKg: 32.5, reps: 7 }] }, suggestion: { kind: "reps", weightKg: 32.5, targetReps: [8, 8, 8] }, records: exerciseRecords([{ weightKg: 32.5, reps: 8, date: "2026-10-20" }]) };
const pullups = { exerciseId: 1, exercise: { name: "Dominadas lastradas", equipment: "peso_corporal", isBodyweight: true }, prescription: { sets: 3, repMin: 5, repMax: 7, restSeconds: 150 }, previous: null, suggestion: { kind: "start", weightKg: null, targetReps: [5, 5, 5] }, records: { bestE1rm: null, byReps: {} } };
const start = () => initWorkout({ session: { id: "s1", routineId: 3, title: "Pull A", bodyweightKg: 91 }, exercises: [pullups, curl], settings: { warmupRestSeconds: 60, bars: { olimpica: 20, z: 10 }, plates: { 10: 2, 5: 2, 2.5: 2, 1.25: 2 } } }, { now: T0, newId });

test("al empezar: series planificadas con el peso y las reps sugeridas", () => {
  const s = start();
  assert.equal(s.session.status, "in_progress");
  assert.equal(s.sets.length, 6);
  const curlSets = s.sets.filter((x) => x.exerciseId === 5);
  assert.deepEqual(curlSets.map((x) => [x.weightKg, x.reps]), [[32.5, 8], [32.5, 8], [32.5, 8]]);
  assert.deepEqual(s.sets.filter((x) => x.exerciseId === 1).map((x) => x.weightKg), [0, 0, 0], "peso corporal sin lastre de arranque");
  assert.equal(s.current, s.exercises[0].key);
  assert.deepEqual(progress(s), { done: 0, total: 6, perExercise: [{ key: s.exercises[0].key, done: 0, total: 3, complete: false }, { key: s.exercises[1].key, done: 0, total: 3, complete: false }] });
});

test("tildar una serie arranca el descanso calculado con el reloj (sigue con la pantalla bloqueada)", () => {
  let s = start();
  const set = s.sets.find((x) => x.exerciseId === 5);
  s = r(s, { type: "toggleDone", setId: set.id, now: T0 + 60_000 });
  assert.equal(s.rest.seconds, 120);
  assert.equal(restRemaining(s.rest, T0 + 60_000), 120);
  assert.equal(restRemaining(s.rest, T0 + 60_000 + 47_000), 73, "a los 47 s (aunque la app estuvo dormida)");
  s = r(s, { type: "restAdjust", seconds: 15, now: T0 + 70_000 });
  assert.equal(restRemaining(s.rest, T0 + 70_000), 125);
  s = r(s, { type: "restAdjust", seconds: -500, now: T0 + 70_000 });
  assert.equal(restRemaining(s.rest, T0 + 70_000), 0, "no queda negativo al restar");
  s = r(s, { type: "restSkip", now: T0 + 71_000 });
  assert.equal(s.rest, null);
});

test("récord en vivo al tildar (y se va si destildás); el calentamiento no cuenta y descansa 60 s", () => {
  let s = start();
  const [a, b] = s.sets.filter((x) => x.exerciseId === 5);
  s = r(s, { type: "edit", setId: a.id, field: "reps", value: 9, now: T0 });
  s = r(s, { type: "toggleDone", setId: a.id, now: T0 + 1000 });
  assert.equal(s.prs.length, 1);
  assert.equal(s.prs[0].e1rm, true, "32,5 × 9 supera 32,5 × 8");
  // La segunda serie igual a la primera ya no es récord (se compara con lo de hoy también).
  s = r(s, { type: "edit", setId: b.id, field: "reps", value: 9, now: T0 });
  s = r(s, { type: "toggleDone", setId: b.id, now: T0 + 2000 });
  assert.equal(s.prs.length, 1);
  s = r(s, { type: "toggleDone", setId: a.id, now: T0 + 3000 });
  assert.equal(s.prs.length, 0, "destildada: deja de contar");
  s = r(s, { type: "addSet", exerciseKey: s.exercises[1].key, setType: "warmup", id: "w1", now: T0 });
  const curlSets = s.sets.filter((x) => x.exerciseId === 5);
  assert.equal(curlSets[0].id, "w1", "el calentamiento va antes de las de trabajo");
  s = r(s, { type: "edit", setId: "w1", field: "weightKg", value: 100, now: T0 });
  s = r(s, { type: "toggleDone", setId: "w1", now: T0 + 5000 });
  assert.equal(s.rest.seconds, 60);
  assert.equal(s.prs.length, 0, "un calentamiento pesado no es récord");
});

test("peso corporal: récord sobre cuerpo + lastre", () => {
  let s = start();
  s = { ...s, exercises: s.exercises.map((e) => (e.exerciseId === 1 ? { ...e, records: exerciseRecords([{ weightKg: 5, reps: 6, bodyweightKg: 91, date: "x" }], { isBodyweight: true }) } : e)) };
  const set = s.sets.find((x) => x.exerciseId === 1);
  s = r(s, { type: "edit", setId: set.id, field: "weightKg", value: 5, now: T0 });
  s = r(s, { type: "edit", setId: set.id, field: "reps", value: 7, now: T0 });
  s = r(s, { type: "toggleDone", setId: set.id, now: T0 + 1000 });
  assert.equal(s.prs[0]?.e1rm, true);
  assert.equal(s.prs[0].e1rmValue, 27.4, "(91 + 5) × (1 + 7/30) − 91");
});

test("agregar, sacar y cambiar ejercicio; terminar todo pasa al siguiente", () => {
  let s = start();
  const first = s.exercises[0].key;
  for (const set of s.sets.filter((x) => x.exerciseKey === first)) s = r(s, { type: "toggleDone", setId: set.id, now: T0 + 1000 });
  assert.equal(s.current, s.exercises[1].key, "terminaste dominadas: el actual es el curl");
  s = r(s, { type: "addSet", exerciseKey: s.exercises[1].key, id: "extra", now: T0 });
  assert.deepEqual(s.sets.find((x) => x.id === "extra"), { id: "extra", exerciseKey: s.exercises[1].key, exerciseId: 5, type: "working", weightKg: 32.5, reps: 8, rir: null, completedAt: null }, "copia la última");
  s = r(s, { type: "removeSet", setId: "extra", now: T0 });
  const hammer = { exerciseId: 9, exercise: { name: "Curl martillo", equipment: "mancuernas" }, prescription: { sets: 2, repMin: 10, repMax: 12, restSeconds: 60 }, suggestion: { kind: "reps", weightKg: 16, targetReps: [12, 12] }, records: { bestE1rm: null, byReps: {} } };
  s = r(s, { type: "addExercise", exercise: hammer, key: "kH", newId, now: T0 });
  assert.equal(s.current, "kH");
  assert.equal(s.sets.filter((x) => x.exerciseKey === "kH").length, 2);
  // Cambiar el curl (sin series hechas) por el martillo de otra marca: las pendientes se reemplazan.
  const inclined = { exerciseId: 7, exercise: { name: "Curl inclinado", equipment: "mancuernas" }, prescription: {}, suggestion: { kind: "reps", weightKg: 12, targetReps: [12, 12, 12] }, records: { bestE1rm: null, byReps: {} } };
  const curlKey = s.exercises[1].key;
  s = r(s, { type: "swapExercise", key: curlKey, exercise: inclined, newKey: "kI", newId, now: T0 });
  assert.equal(s.exercises.some((e) => e.key === curlKey), false);
  assert.deepEqual(s.sets.filter((x) => x.exerciseKey === "kI").map((x) => x.weightKg), [12, 12, 12]);
  assert.equal(s.exercises.find((e) => e.key === "kI").prescription.restSeconds, 120, "mantiene la prescripción del original");
  s = r(s, { type: "removeExercise", key: "kH", now: T0 });
  assert.equal(s.exercises.length, 2);
});

test("snapshot para subir: orden de ejercicios y series, y si quedó algo sin subir", () => {
  let s = start();
  assert.equal(isDirty(s), true);
  s = r(s, { type: "synced", version: s.session.updatedAt });
  assert.equal(isDirty(s), false);
  s = r(s, { type: "edit", setId: s.sets[0].id, field: "weightKg", value: 5, now: T0 + 5000 });
  assert.equal(isDirty(s), true);
  const snap = toSnapshot(s);
  assert.equal(snap.id, "s1");
  assert.equal(snap.sets.length, 6);
  assert.deepEqual(snap.sets.map((x) => [x.exerciseOrder, x.setOrder]), [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
  s = r(s, { type: "finish", now: T0 + 3_600_000 });
  assert.equal(s.session.status, "done");
  assert.ok(s.session.endedAt);
});

test("discos para la serie (solo con barra)", () => {
  const s = start();
  assert.deepEqual(platesFor(curl.exercise, 32.5, s.settings).perSide, [10, 1.25]);
  assert.equal(platesFor(curl.exercise, 32.5, s.settings).barKg, 10);
  assert.equal(platesFor(pullups.exercise, 10, s.settings), null);
});

test("retomar desde el server: mismas series, mismo orden y sin nada pendiente de subir", async () => {
  const { fromSavedSession, toSnapshot: snap } = await import("../fisico/workout.js");
  let s = start();
  s = r(s, { type: "toggleDone", setId: s.sets[0].id, now: T0 + 1000 });
  const saved = { ...snap(s), sets: snap(s).sets };
  const back = fromSavedSession({ exercises: [pullups, curl], settings: s.settings, priorityMuscles: ["biceps"] }, saved, new Map(), { newId });
  assert.deepEqual(back.sets.map((x) => [x.id, x.exerciseId, !!x.completedAt]), s.sets.map((x) => [x.id, x.exerciseId, !!x.completedAt]));
  assert.equal(back.current, back.exercises[0].key, "dominadas todavía tiene series pendientes");
  assert.equal(isDirty(back), false);
  assert.deepEqual(back.meta.priorityMuscles, ["biceps"]);
});
