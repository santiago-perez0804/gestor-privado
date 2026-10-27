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
