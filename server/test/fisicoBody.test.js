import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { sharedSchema } from "../src/db/schema/shared.js";
import { fisicoSchema } from "../src/db/schema/fisico.js";
import { migrateFisicoV2 } from "../src/db/migrations/fisicoV2.js";
import { createBody } from "../src/services/fisico/body.js";
import { addDays, localDate } from "../../shared/fisico/dates.js";

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(sharedSchema);
  db.exec(fisicoSchema);
  migrateFisicoV2(db);
  return { db, body: createBody(db) };
}

test("peso: sin pesadas no rompe; con pesadas da tendencia, ritmo, meta y proyección", () => {
  const { db, body } = setup();
  const empty = body.summary();
  assert.equal(empty.current, null);
  assert.equal(empty.rate, null);
  assert.deepEqual(empty.weeks, []);
  const today = localDate(new Date());
  const ins = db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (?, ?, 'x')");
  for (let i = 40; i >= 0; i -= 3) ins.run(92 - (40 - i) * 0.04, `${addDays(today, -i)}T08:00`);
  body.setGoal({ target: 86, targetDate: addDays(today, 100) });
  const s = body.summary();
  assert.ok(s.current < 92 && s.current > 90);
  assert.ok(s.rate.kgPerWeek < 0);
  assert.equal(s.goal.target, 86);
  assert.equal(s.projection.direction, "down");
  assert.ok(s.projection.neededKgPerWeek < 0);
  assert.equal(s.chart.lines.length, 2, "ritmo actual y ritmo para la meta");
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'weight_goal_kg'").get().value, "86", "el widget sigue viendo la meta");
  assert.throws(() => body.setGoal({ target: 5 }), { message: "invalid_target" });
  // Meta exigente: avisa y propone una fecha saludable.
  body.setGoal({ target: 80, targetDate: addDays(today, 21) });
  const hard = body.summary();
  assert.equal(hard.neededStatus, "fast");
  assert.ok(hard.healthyDate > addDays(today, 21));
});

test("medidas: sesión guiada, dirección por zona, relaciones, próxima y borrar", async () => {
  const { createMeasurements } = await import("../src/services/fisico/measurements.js");
  const { saveSettings } = await import("../src/services/fisico/common.js");
  const { db } = setup();
  const m = createMeasurements(db);
  assert.equal(m.summary().next.never, true);
  m.saveSession({ measuredOn: "2026-09-23", values: { cintura: 98, brazo: 36, hombros: 120 } });
  const id = m.saveSession({ measuredOn: "2026-10-21", values: { cintura: 96.5, brazo: 36.5, hombros: 121.5, muslo: "" } });
  assert.throws(() => m.saveSession({ values: { cintura: 2 } }), { message: "invalid_value" });
  assert.throws(() => m.saveSession({ values: { nariz: 30 } }), { message: "invalid_zone" });
  assert.throws(() => m.saveSession({ values: {} }), { message: "values_required" });
  const s = m.summary();
  const zone = (z) => s.zones.find((x) => x.zone === z);
  assert.equal(zone("cintura").trend.verdict, "good", "cintura que baja");
  assert.equal(zone("brazo").trend.verdict, "good");
  assert.equal(zone("muslo").series.length, 0, "vacía no se guarda");
  assert.equal(s.ratios.shouldersToWaist, 1.26);
  assert.equal(s.ratios.waistToHeight, null);
  assert.equal(s.next.date, "2026-11-04");
  saveSettings(db, { heightCm: 180 });
  assert.equal(m.summary().ratios.waistToHeight, 0.54);
  assert.throws(() => saveSettings(db, { heightCm: 20 }), { message: "invalid_height" });
  m.removeSession(id);
  assert.equal(m.summary().sessions.length, 1);
});
