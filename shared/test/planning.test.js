import { test } from "node:test";
import assert from "node:assert/strict";
import { contributions, plannedVolume, doneVolume, weeklyVolume, routineVolume, shortMuscles } from "../fisico/volume.js";
import { weekPlan, nextWorkout, weekStreak, weekMet } from "../fisico/schedule.js";
import { weekDays } from "../fisico/dates.js";

const muscles = (s) => s.split(" ").map((x) => ({ muscle: x.split(":")[0], role: x.endsWith(":P") ? "primary" : "secondary" }));
const exercises = new Map([
  [1, { muscles: muscles("espalda:P biceps:S") }], // dominadas
  [2, { muscles: muscles("espalda:P deltoide_posterior:S biceps:S") }], // remo
  [3, { muscles: muscles("biceps:P antebrazo:S") }], // curl
  [4, { muscles: muscles("pecho:P triceps:S hombro_anterior:S") }], // press
]);

test("conteo fraccional: primario 1 serie, secundario ½", () => {
  assert.deepEqual(contributions(exercises.get(2).muscles, 3), { espalda: 3, deltoide_posterior: 1.5, biceps: 1.5 });
});

test("volumen planificado (rutinas × agenda) y hecho (solo series de trabajo completadas)", () => {
  const routines = new Map([
    [10, [{ exerciseId: 1, sets: 3 }, { exerciseId: 2, sets: 3 }, { exerciseId: 3, sets: 3 }]], // Pull
    [20, [{ exerciseId: 4, sets: 4 }]], // Push
  ]);
  const planned = plannedVolume([20, 10, null, 20, 10, null, null], routines, exercises);
  assert.deepEqual(planned, { pecho: 8, triceps: 4, hombro_anterior: 4, espalda: 12, biceps: 12, deltoide_posterior: 3, antebrazo: 3 });
  assert.deepEqual(routineVolume(routines.get(10), exercises), { espalda: 6, biceps: 6, deltoide_posterior: 1.5, antebrazo: 1.5 });
  const done = doneVolume(
    [
      { exerciseId: 4, type: "working", completedAt: "x" },
      { exerciseId: 4, type: "warmup", completedAt: "x" },
      { exerciseId: 4, type: "working", completedAt: null },
      { exerciseId: 3, type: "working", completedAt: "x" },
    ],
    exercises
  );
  assert.deepEqual(done, { pecho: 1, triceps: 0.5, hombro_anterior: 0.5, biceps: 1, antebrazo: 0.5 });
  const rows = weeklyVolume({ planned, done, range: { min: 10, max: 20 }, priorityMuscles: ["biceps"] });
  const row = (m) => rows.find((r) => r.muscle === m);
  assert.deepEqual(row("biceps"), { muscle: "biceps", planned: 12, done: 1, status: "in_range", priority: true });
  assert.equal(row("pecho").status, "low");
  assert.equal(rows.length, 13, "los 13 músculos");
  assert.deepEqual(shortMuscles(rows, { min: 10, ignore: ["triceps"] }).map((r) => r.muscle), ["pecho", "hombro_anterior", "deltoide_posterior", "antebrazo"]);
});

test("semana sin entrenos y sin plan: todo en cero, estado según lo hecho", () => {
  const rows = weeklyVolume({});
  assert.ok(rows.every((r) => r.planned === 0 && r.done === 0 && r.status === "low"));
});

// Semana del lunes 26 de octubre de 2026. Push lun/jue, Pull mar/vie, Legs mié.
const days = weekDays("2026-10-26");
const schedule = { 1: { routineId: 1 }, 2: { routineId: 2, extras: ["calistenia"] }, 3: { routineId: 3 }, 4: { routineId: 1, extras: ["calistenia"] }, 5: { routineId: 2 }, 6: { routineId: null, extras: ["bici"] }, 7: { routineId: null } };

test("semana: hecho, hoy, mañana, pendiente y descanso", () => {
  const plan = weekPlan({ days, schedule, sessions: [{ localDate: "2026-10-26", routineId: 1 }], today: "2026-10-26" });
  assert.deepEqual(plan.days.map((d) => d.status), ["done", "tomorrow", "pending", "pending", "pending", "rest", "rest"]);
  assert.deepEqual(plan.days[1].extras, ["calistenia"]);
  assert.equal(nextWorkout(plan).routineId, 2);
  assert.deepEqual([plan.planned, plan.done], [5, 1]);
});

test("reprogramación: si faltás, la rutina pasa al siguiente día libre de la semana", () => {
  // Faltó el martes (Pull). Hoy jueves.
  const plan = weekPlan({ days, schedule, sessions: [{ localDate: "2026-10-26", routineId: 1 }, { localDate: "2026-10-28", routineId: 3 }], today: "2026-10-29" });
  const tue = plan.days[1];
  const sat = plan.days[5];
  assert.equal(tue.status, "moved");
  assert.equal(tue.movedTo, "2026-10-31");
  assert.equal(sat.routineId, 2);
  assert.equal(sat.movedFrom, "2026-10-27");
  assert.equal(sat.status, "pending");
  assert.deepEqual(sat.extras, ["bici"], "la bici sigue ahí");
  // Si después lo hacés el sábado, cumple el martes.
  const later = weekPlan({ days, schedule, sessions: [{ localDate: "2026-10-26", routineId: 1 }, { localDate: "2026-10-28", routineId: 3 }, { localDate: "2026-10-31", routineId: 2 }], today: "2026-10-31" });
  assert.equal(later.days[5].status, "done");
  assert.equal(later.days[1].movedTo, "2026-10-31");
  assert.equal(later.done, 3);
  // También faltaron el jueves (Push) y el viernes (Pull): el más viejo se queda con el domingo.
  assert.equal(later.days[3].movedTo, "2026-11-01");
  assert.equal(later.days[4].status, "skipped");
});

test("reprogramación: sin días libres que queden, la rutina se saltea", () => {
  const plan = weekPlan({ days, schedule, sessions: [], today: "2026-11-01" });
  assert.equal(plan.days[0].status, "moved", "la primera que faltó pasa al domingo (el único libre que queda)");
  assert.equal(plan.days[6].routineId, 1);
  assert.equal(plan.days[6].status, "today");
  assert.deepEqual(plan.days.slice(1, 5).map((d) => d.status), ["skipped", "skipped", "skipped", "skipped"]);
});

test("hacer una rutina otro día cumple el día planificado (no cuenta doble)", () => {
  const plan = weekPlan({ days, schedule, sessions: [{ localDate: "2026-10-27", routineId: 1 }], today: "2026-10-28" });
  assert.equal(plan.days[1].status, "done");
  assert.equal(plan.done, 1);
});

test("racha de semanas cumplidas (≥ 80 %)", () => {
  assert.equal(weekMet({ planned: 5, done: 4 }), true);
  assert.equal(weekMet({ planned: 5, done: 3 }), false);
  assert.equal(weekMet({ planned: 0, done: 0 }), false);
  const past = [{ planned: 5, done: 5 }, { planned: 0, done: 0 }, { planned: 5, done: 4 }, { planned: 5, done: 2 }, { planned: 5, done: 5 }];
  assert.equal(weekStreak(past, { planned: 5, done: 1 }), 2, "la semana sin plan no corta; la de 2/5 sí");
  assert.equal(weekStreak(past, { planned: 5, done: 4 }), 3, "la actual suma si ya está cumplida");
  assert.equal(weekStreak([], null), 0);
});
