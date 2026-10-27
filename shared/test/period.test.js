import { test } from "node:test";
import assert from "node:assert/strict";
import { closingDate, periodBounds, billingMonthOf, periodProgress, calendarDateIn, withCustomPeriod, withoutCustomPeriod } from "../finanzas/period.js";

const nov = { year: 2026, month: 10 };
const def = { cutoffDay: 26 };

test("por defecto: cierra el mismo día todos los meses", () => {
  assert.deepEqual(periodBounds(nov, def), { start: "2026-10-27", end: "2026-11-26" });
  assert.deepEqual(billingMonthOf("2026-10-27", def), nov);
  assert.deepEqual(billingMonthOf("2026-10-26", def), { year: 2026, month: 9 });
  assert.deepEqual(billingMonthOf("2026-12-30", def), { year: 2027, month: 0 }, "cruza el año");
});

test("período a mano: del 23 de octubre al 19 de noviembre", () => {
  const closings = withCustomPeriod(nov, { start: "2026-10-23", end: "2026-11-19" }, def);
  assert.deepEqual(closings, { "2026-10": "2026-10-22", "2026-11": "2026-11-19" });
  const cfg = { cutoffDay: 26, closings };
  assert.deepEqual(periodBounds(nov, cfg), { start: "2026-10-23", end: "2026-11-19" });
  assert.deepEqual(periodBounds({ year: 2026, month: 9 }, cfg), { start: "2026-09-27", end: "2026-10-22" }, "el anterior termina el 22");
  assert.deepEqual(periodBounds({ year: 2026, month: 11 }, cfg), { start: "2026-11-20", end: "2026-12-26" }, "el siguiente arranca el 20");
  assert.deepEqual(billingMonthOf("2026-10-23", cfg), nov);
  assert.deepEqual(billingMonthOf("2026-10-22", cfg), { year: 2026, month: 9 });
  assert.deepEqual(billingMonthOf("2026-11-20", cfg), { year: 2026, month: 11 });
  const p = periodProgress(nov, "2026-10-27", cfg);
  assert.deepEqual([p.totalDays, p.dayNumber, p.daysLeft], [28, 5, 23]);
  assert.equal(closingDate(nov, cfg), "2026-11-19");
});

test("recurrentes: el día del mes que cae dentro del período", () => {
  const cfg = { cutoffDay: 26, closings: { "2026-10": "2026-10-22", "2026-11": "2026-11-19" } };
  assert.equal(calendarDateIn(nov, 25, cfg), "2026-10-25", "el 25 de octubre ya es del período de noviembre");
  assert.equal(calendarDateIn(nov, 5, cfg), "2026-11-05");
  assert.equal(calendarDateIn(nov, 21, cfg), "2026-11-19", "el 21 no cae: el cierre");
  assert.equal(calendarDateIn(nov, 10, def), "2026-11-10");
  assert.equal(calendarDateIn(nov, 28, def), "2026-10-28");
  assert.equal(calendarDateIn({ year: 2027, month: 1 }, 31, { cutoffDay: 28 }), "2027-01-31", "31 de enero en el período de febrero (cierre 28)");
});

test("validaciones y volver al cierre por defecto", () => {
  assert.throws(() => withCustomPeriod(nov, { start: "2026-11-10", end: "2026-11-19" }, def), { message: "invalid_length" });
  assert.throws(() => withCustomPeriod(nov, { start: "x", end: "2026-11-19" }, def), { message: "invalid_dates" });
  assert.throws(() => withCustomPeriod(nov, { start: "2026-10-23", end: "2026-12-01" }, { cutoffDay: 26, closings: { "2026-12": "2026-11-30" } }), { message: "overlaps_neighbor" });
  const back = withoutCustomPeriod(nov, { closings: { "2026-10": "2026-10-22", "2026-11": "2026-11-19", "2027-01": "2027-01-23" } });
  assert.deepEqual(back, { "2027-01": "2027-01-23" });
  assert.deepEqual(periodBounds(nov, { cutoffDay: 26, closings: back }), { start: "2026-10-27", end: "2026-11-26" });
});
