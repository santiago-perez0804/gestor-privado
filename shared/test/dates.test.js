import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate, localDateTime, dayOf, addDays, daysBetween, weekday, weekStart, weekDays, dayRange } from "../fisico/dates.js";

test("día local en Buenos Aires: una pesada a las 00:30 es de ese día", () => {
  // 00:30 en Buenos Aires = 03:30 UTC.
  assert.equal(localDate(new Date("2026-10-27T03:30:00Z")), "2026-10-27");
  assert.equal(localDate(new Date("2026-10-27T02:59:00Z")), "2026-10-26", "23:59 del día anterior");
  assert.equal(localDateTime(new Date("2026-10-27T03:30:00Z")), "2026-10-27T00:30");
  assert.equal(dayOf("2026-10-27T00:30"), "2026-10-27", "hora local sin zona: ese día");
  assert.equal(dayOf("2026-10-27T03:30:00Z"), "2026-10-27", "instante UTC → día local");
  assert.equal(dayOf("2026-10-27"), "2026-10-27");
});

test("aritmética de días sin saltos por horario de verano", () => {
  // En Europa/Madrid y EE. UU. hay cambio de hora; los días como texto no se corren.
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
  assert.equal(daysBetween("2026-11-01", "2026-11-02"), 1);
  assert.equal(localDate(new Date("2026-03-29T00:30:00Z"), "Europe/Madrid"), "2026-03-29");
  assert.equal(localDate(new Date("2026-03-29T23:30:00Z"), "Europe/Madrid"), "2026-03-30", "después del cambio a UTC+2");
  assert.equal(dayRange("2026-03-28", "2026-03-31").length, 4);
});

test("semana de lunes a domingo", () => {
  assert.equal(weekday("2026-10-26"), 1, "lunes");
  assert.equal(weekday("2026-11-01"), 7, "domingo");
  assert.equal(weekStart("2026-11-01"), "2026-10-26");
  assert.deepEqual(weekDays("2026-10-28"), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
