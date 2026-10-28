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
import { getSettings, saveSettings } from "../src/services/fisico/common.js";

async function setup() {
  const db = await testDb();
  const exercises = createExercises(db);
  const history = createHistory(db);
  const plans = createPlans(db, { history });
  const ex = async (name) => (await exercises.list({ q: name })).find((e) => e.name === name);
  return { db, exercises, history, plans, ex };
}

/** Un entreno terminado con series de trabajo (para probar "última vez" y "próxima"). */
async function logSession(db, { id, date, routineId = null, bodyweightKg = 91, sets }) {
  const ts = `${date}T20:00:00.000Z`;
  await db.prepare("INSERT INTO workout_sessions (id, routineId, title, startedAt, endedAt, status, localDate, bodyweightKg, createdAt, updatedAt) VALUES (?, ?, 'x', ?, ?, 'done', ?, ?, ?, ?)").run(id, routineId, ts, ts, date, bodyweightKg, ts, ts);
  for (const [i, [exerciseId, weightKg, reps, type = "working"]] of sets.entries())
    await db.prepare("INSERT INTO set_logs (id, sessionId, exerciseId, exerciseOrder, setOrder, type, weightKg, reps, completedAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)").run(`${id}-${i}`, id, exerciseId, i, type, weightKg, reps, ts, ts);
}

test("biblioteca: búsqueda sin tildes, filtro por músculo y equipo, propios y alternativas", async () => {
  const { exercises, ex } = await setup();
  assert.ok((await exercises.list({ q: "jalon" })).some((e) => e.name === "Jalón al pecho"), "sin tilde encuentra con tilde");
  assert.ok((await exercises.list({ muscle: "biceps" })).every((e) => e.muscles.some((m) => m.muscle === "biceps")));
  assert.ok((await exercises.list({ equipment: "polea" })).every((e) => e.equipment === "polea"));
  const mine = await exercises.create({ name: "Curl araña", equipment: "barra", muscles: [{ muscle: "biceps", role: "primary" }] });
  assert.equal(mine.isCustom, true);
  assert.equal(mine.bar, "olimpica");
  await assert.rejects(async () => await exercises.create({ name: "curl araña", equipment: "barra", muscles: [{ muscle: "biceps", role: "primary" }] }), { message: "name_taken" });
  await assert.rejects(async () => await exercises.create({ name: "X", muscles: [{ muscle: "biceps", role: "secondary" }] }), { message: "primary_muscle_required" });
  await assert.rejects(async () => await exercises.create({ name: "X", muscles: [{ muscle: "nariz", role: "primary" }] }), { message: "primary_muscle_required" });
  const alts = await exercises.alternatives((await ex("Curl con barra")).id);
  assert.ok(alts.length > 3 && alts.every((a) => a.muscles.some((m) => m.role === "primary" && m.muscle === "biceps")));
  assert.equal((await exercises.get((await ex("Dominadas lastradas")).id)).isBodyweight, true);
});

test("biblioteca grande: busca en inglés con músculos traducidos e importa una sola vez", async () => {
  const { db, exercises } = await setup();
  const ins = db.prepare("INSERT INTO exercise_library (id, name, equipment, primaryMuscles, secondaryMuscles, instructions, category) VALUES (?, ?, ?, ?, ?, ?, ?)");
  await ins.run("Cable_Lateral_Raise", "Cable Lateral Raise", "cable", '["shoulders"]', "[]", '["Stand next to the cable."]', "strength");
  await ins.run("Reverse_Flyes", "Reverse Flyes", "dumbbell", '["shoulders"]', '["middle back"]', "[]", "strength");
  await ins.run("Hamstring_Stretch", "Hamstring Stretch", "body only", '["hamstrings"]', "[]", "[]", "stretching");
  assert.deepEqual((await exercises.searchLegacy({ q: "lateral" }))[0].muscles, [{ muscle: "hombro_lateral", role: "primary" }]);
  assert.deepEqual((await exercises.searchLegacy({ q: "reverse" }))[0].muscles, [{ muscle: "deltoide_posterior", role: "primary" }, { muscle: "espalda", role: "secondary" }]);
  assert.equal((await exercises.searchLegacy({ q: "stretch" })).length, 0, "elongaciones no");
  const imp = await exercises.importLegacy("Cable_Lateral_Raise", { name: "Vuelos laterales en polea" });
  assert.equal(imp.name, "Vuelos laterales en polea");
  assert.equal(imp.equipment, "polea");
  assert.equal((await exercises.importLegacy("Cable_Lateral_Raise")).id, imp.id, "no se duplica");
  assert.equal((await exercises.searchLegacy({ q: "lateral" }))[0].imported, true);
});

test("plan: crear, activar (uno solo), agenda, rutinas, ejercicios, orden y volumen", async () => {
  const { db, plans, ex } = await setup();
  const p = await plans.create({ name: "PPL", startDate: "2026-09-14", weeks: 13, deloadWeek: 7, priorityMuscles: ["biceps", "pecho"], dailyExtras: ["Caminata"] });
  assert.equal(p.isActive, true, "el primer plan queda activo");
  assert.deepEqual(p.dailyExtras, ["caminata"]);
  assert.equal(p.schedule.length, 7);
  const pull = await plans.createRoutine(p.id, { name: "Pull A", description: "Espalda y bíceps pesado" });
  const push = await plans.createRoutine(p.id, { name: "Push A" });
  await plans.addItem(pull.id, { exerciseId: (await ex("Dominadas lastradas")).id, sets: 3, repMin: 5, repMax: 7, restSeconds: 150, rirMin: 1, rirMax: 2 });
  await plans.addItem(pull.id, { exerciseId: (await ex("Remo con barra")).id, sets: 3, repMin: 8, repMax: 10 });
  const r = await plans.addItem(pull.id, { exerciseId: (await ex("Curl con barra")).id, sets: 3, repMin: 6, repMax: 8 });
  assert.deepEqual(r.items.map((i) => i.exercise.name), ["Dominadas lastradas", "Remo con barra", "Curl con barra"]);
  assert.deepEqual(r.volume, { espalda: 6, biceps: 6, deltoide_posterior: 1.5, antebrazo: 1.5 });
  assert.equal(r.setCount, 9);
  await plans.addItem(push.id, { exerciseId: (await ex("Press banca plano")).id, sets: 4, repMin: 6, repMax: 8 });

  const reordered = await plans.reorderItems(pull.id, [r.items[2].id, r.items[0].id, r.items[1].id]);
  assert.equal(reordered.items[0].exercise.name, "Curl con barra");
  await assert.rejects(async () => await plans.reorderItems(pull.id, [r.items[0].id]), { message: "invalid_order" });

  await plans.setSchedule(p.id, [
    { weekday: 1, routineId: push.id },
    { weekday: 2, routineId: pull.id, extras: ["calistenia"] },
    { weekday: 4, routineId: push.id, extras: ["Calistenia", "calistenia"] },
    { weekday: 5, routineId: pull.id },
    { weekday: 6, routineId: null, extras: ["bici"] },
  ]);
  const d = await plans.detail(p.id);
  assert.deepEqual(d.schedule[3].extras, ["calistenia"], "sin repetidos");
  const vol = (m) => d.weeklyVolume.find((x) => x.muscle === m);
  assert.deepEqual([vol("biceps").planned, vol("biceps").priority], [12, true], "dos Pull por semana");
  assert.equal(vol("pecho").planned, 8);
  assert.ok(d.shortMuscles.some((m) => m.muscle === "pecho"));
  assert.ok(d.currentWeek >= 1);

  const other = await plans.create({ name: "Bloque 2" });
  assert.equal(other.isActive, false);
  await plans.activate(other.id);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM plans WHERE isActive = 1").get()).n, 1);
  await assert.rejects(async () => await plans.setSchedule(other.id, [{ weekday: 1, routineId: push.id }]), { message: "routine_not_in_plan" });
  await assert.rejects(async () => await plans.addItem(pull.id, { exerciseId: (await ex("Remo con barra")).id, repMin: 10, repMax: 8 }), { message: "repMax_below_repMin" });
  await assert.rejects(async () => await plans.create({ name: "X", weeks: 4, deloadWeek: 6 }), { message: "deload_after_end" });
  await assert.rejects(async () => await plans.create({ name: "X", priorityMuscles: ["nariz"] }), { message: "invalid_priorityMuscles" });
});

test("duplicar plan copia rutinas, ejercicios y agenda apuntando a las rutinas nuevas", async () => {
  const { plans, ex } = await setup();
  const p = await plans.create({ name: "PPL" });
  const pull = await plans.createRoutine(p.id, { name: "Pull A" });
  await plans.addItem(pull.id, { exerciseId: (await ex("Curl con barra")).id, sets: 3, repMin: 6, repMax: 8 });
  await plans.setSchedule(p.id, [{ weekday: 2, routineId: pull.id, extras: ["calistenia"] }]);
  const copy = await plans.duplicate(p.id, { name: "PPL · bloque 2", startDate: "2026-12-14" });
  assert.equal(copy.name, "PPL · bloque 2");
  assert.equal(copy.isActive, false);
  assert.equal(copy.routines[0].items[0].exercise.name, "Curl con barra");
  assert.notEqual(copy.routines[0].id, pull.id);
  assert.equal(copy.schedule[1].routineId, copy.routines[0].id);
  assert.deepEqual(copy.schedule[1].extras, ["calistenia"]);
});

test("última vez y próxima (doble progresión) en la rutina; ejercicio usado se archiva", async () => {
  const { db, plans, exercises, ex } = await setup();
  const p = await plans.create({ name: "PPL" });
  const pull = await plans.createRoutine(p.id, { name: "Pull A" });
  const curl = await ex("Curl con barra");
  const inclined = await ex("Curl inclinado con mancuernas");
  await plans.addItem(pull.id, { exerciseId: curl.id, sets: 3, repMin: 6, repMax: 8 });
  await plans.addItem(pull.id, { exerciseId: inclined.id, sets: 3, repMin: 10, repMax: 12 });
  await logSession(db, { id: "s1", date: "2026-10-20", routineId: pull.id, sets: [[curl.id, 20, 10, "warmup"], [curl.id, 32.5, 8], [curl.id, 32.5, 8], [curl.id, 32.5, 7], [inclined.id, 12, 12], [inclined.id, 12, 12], [inclined.id, 12, 12]] });
  const r = await plans.routine(pull.id);
  assert.deepEqual(r.items[0].last.sets.map((s) => s.reps), [8, 8, 7], "sin el calentamiento");
  assert.deepEqual([r.items[0].next.kind, r.items[0].next.weightKg, r.items[0].next.targetReps], ["reps", 32.5, [8, 8, 8]]);
  assert.deepEqual([r.items[1].next.kind, r.items[1].next.weightKg], ["increase", 14], "mancuernas: +2 kg");
  await saveSettings(db, { progressionStepKg: { mancuernas: 2.5 } });
  assert.equal((await getSettings(db)).progressionStepKg.barra, 2.5, "los demás pasos quedan");
  assert.equal((await plans.routine(pull.id)).items[1].next.weightKg, 14.5, "paso configurable");
  assert.deepEqual(await exercises.remove(curl.id), { archived: true });
  assert.equal((await exercises.list({ q: "Curl con barra" })).some((e) => e.id === curl.id), false, "archivado: no aparece en la búsqueda");
  assert.equal((await plans.routine(pull.id)).items[0].exercise.name, "Curl con barra", "pero la rutina lo sigue mostrando");
});
