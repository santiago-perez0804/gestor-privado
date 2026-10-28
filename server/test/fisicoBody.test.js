import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { sharedSchema } from "../src/db/schema/shared.js";
import { fisicoSchema } from "../src/db/schema/fisico.js";
import { migrateFisicoV2 } from "../src/db/migrations/fisicoV2.js";
import { createBody } from "../src/services/fisico/body.js";
import { addDays, localDate } from "../../shared/fisico/dates.js";

async function setup() {
  const db = await testDb();
  return { db, body: createBody(db) };
}

test("peso: sin pesadas no rompe; con pesadas da tendencia, ritmo, meta y proyección", async () => {
  const { db, body } = await setup();
  const empty = await body.summary();
  assert.equal(empty.current, null);
  assert.equal(empty.rate, null);
  assert.deepEqual(empty.weeks, []);
  const today = localDate(new Date());
  const ins = db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (?, ?, 'x')");
  for (let i = 40; i >= 0; i -= 3) await ins.run(92 - (40 - i) * 0.04, `${addDays(today, -i)}T08:00`);
  await body.setGoal({ target: 86, targetDate: addDays(today, 100) });
  const s = await body.summary();
  assert.ok(s.current < 92 && s.current > 90);
  assert.ok(s.rate.kgPerWeek < 0);
  assert.equal(s.goal.target, 86);
  assert.equal(s.projection.direction, "down");
  assert.ok(s.projection.neededKgPerWeek < 0);
  assert.equal(s.chart.lines.length, 2, "ritmo actual y ritmo para la meta");
  assert.equal((await db.prepare("SELECT value FROM settings WHERE key = 'weight_goal_kg'").get()).value, "86", "el widget sigue viendo la meta");
  await assert.rejects(async () => await body.setGoal({ target: 5 }), { message: "invalid_target" });
  // Meta exigente: avisa y propone una fecha saludable.
  await body.setGoal({ target: 80, targetDate: addDays(today, 21) });
  const hard = await body.summary();
  assert.equal(hard.neededStatus, "fast");
  assert.ok(hard.healthyDate > addDays(today, 21));
});

test("medidas: sesión guiada, dirección por zona, relaciones, próxima y borrar", async () => {
  const { createMeasurements } = await import("../src/services/fisico/measurements.js");
  const { saveSettings } = await import("../src/services/fisico/common.js");
  const { db } = await setup();
  const m = createMeasurements(db);
  assert.equal((await m.summary()).next.never, true);
  await m.saveSession({ measuredOn: "2026-09-23", values: { cintura: 98, brazo: 36, hombros: 120 } });
  const id = await m.saveSession({ measuredOn: "2026-10-21", values: { cintura: 96.5, brazo: 36.5, hombros: 121.5, muslo: "" } });
  await assert.rejects(async () => await m.saveSession({ values: { cintura: 2 } }), { message: "invalid_value" });
  await assert.rejects(async () => await m.saveSession({ values: { nariz: 30 } }), { message: "invalid_zone" });
  await assert.rejects(async () => await m.saveSession({ values: {} }), { message: "values_required" });
  const s = await m.summary();
  const zone = (z) => s.zones.find((x) => x.zone === z);
  assert.equal(zone("cintura").trend.verdict, "good", "cintura que baja");
  assert.equal(zone("brazo").trend.verdict, "good");
  assert.equal(zone("muslo").series.length, 0, "vacía no se guarda");
  assert.equal(s.ratios.shouldersToWaist, 1.26);
  assert.equal(s.ratios.waistToHeight, null);
  assert.equal(s.next.date, "2026-11-04");
  await saveSettings(db, { heightCm: 180 });
  assert.equal((await m.summary()).ratios.waistToHeight, 0.54);
  await assert.rejects(() => saveSettings(db, { heightCm: 20 }), { message: "invalid_height" });
  await m.removeSession(id);
  assert.equal((await m.summary()).sessions.length, 1);
});

test("hábitos: tildar hoy, racha, últimos 7 días, agregar y quitar", async () => {
  const { createHabits } = await import("../src/services/fisico/habits.js");
  const { db } = await setup();
  const habits = createHabits(db);
  const l = await habits.list();
  assert.equal(l.habits.length, 5, "los de la semilla");
  const creatina = l.habits.find((h) => h.name === "Creatina");
  const today = localDate(new Date());
  for (let i = 1; i <= 3; i++) await habits.toggle(creatina.id, { day: addDays(today, -i), done: true });
  let after = await habits.toggle(creatina.id, { done: true });
  const c = after.habits.find((h) => h.id === creatina.id);
  assert.equal(c.doneToday, true);
  assert.equal(c.streak, 4);
  assert.equal(c.week.filter((d) => d.done).length, 4);
  assert.equal(after.best.name, "Creatina");
  after = await habits.toggle(creatina.id, { done: false });
  assert.equal(after.habits.find((h) => h.id === creatina.id).streak, 3, "destildar hoy: la racha cuenta hasta ayer");
  await assert.rejects(async () => await habits.toggle(creatina.id, { day: addDays(today, 1), done: true }), { message: "invalid_day" });
  await habits.create({ name: "Estirar", targetLabel: "10 min" });
  const added = (await habits.list()).habits.find((h) => h.name === "Estirar");
  await habits.update(added.id, { archived: true });
  assert.equal((await habits.list()).habits.some((h) => h.name === "Estirar"), false);
});
