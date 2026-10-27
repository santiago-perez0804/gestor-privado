import { test } from "node:test";
import assert from "node:assert/strict";
import { trendSeries, trendAt, weeklyRate, projection, rateStatus, weeklyAverages, typoCheck, dailyWeights } from "../fisico/weight.js";
import { byZone, zoneTrend, ratios, nextDue, changeBetween } from "../fisico/measurements.js";
import { lastDays, habitStreak, habitsSummary } from "../fisico/habits.js";
import { recompositionSignals, strengthChange } from "../fisico/recomposition.js";
import { num, signed, kg, parseNum, setsLine } from "../fisico/format.js";
import { addDays } from "../fisico/dates.js";

const near = (a, b, eps = 0.02) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("tendencia: interpola días sin pesada y suaviza con α = 0,1", () => {
  const s = trendSeries([{ day: "2026-10-01", kg: 92 }, { day: "2026-10-03", kg: 91 }], { until: "2026-10-05" });
  assert.equal(s.length, 5);
  assert.equal(s[1].kg, null);
  assert.equal(s[1].interpolated, 91.5);
  near(s[1].trend, 91.95);
  near(s[2].trend, 91.855);
  assert.equal(s[4].interpolated, 91, "después de la última pesada se mantiene el valor");
  assert.equal(trendAt(s, "2026-10-02"), s[1].trend);
  assert.equal(trendAt(s, "2026-09-01"), null);
});

test("una sola pesada: hay tendencia pero no ritmo", () => {
  const s = trendSeries([{ day: "2026-10-26", kg: 90.1 }], { until: "2026-10-30" });
  assert.equal(trendAt(s, "2026-10-30"), 90.1);
  assert.equal(weeklyRate(s, "2026-10-30"), null);
});

test("varias pesadas el mismo día se promedian", () => {
  assert.deepEqual(dailyWeights([{ day: "d", kg: 90 }, { day: "d", kg: 91 }]), [{ day: "d", kg: 90.5 }]);
});

test("ritmo semanal: 28 días ÷ 4, en kg y % del peso", () => {
  const weighIns = Array.from({ length: 57 }, (_, i) => ({ day: addDays("2026-09-01", i), kg: 93 - i * 0.03 }));
  const s = trendSeries(weighIns);
  const r = weeklyRate(s, "2026-10-27");
  near(r.kgPerWeek, -0.21, 0.01);
  assert.equal(r.partial, false);
  assert.ok(r.pctPerWeek < 0 && r.pctPerWeek > -0.3);
  const short = weeklyRate(trendSeries(weighIns.slice(0, 12)), "2026-09-12");
  assert.equal(short.partial, true);
});

test("proyección: fecha estimada, ritmo necesario y meta ya alcanzada", () => {
  const p = projection({ current: 91.4, kgPerWeek: -0.21, target: 86, targetDate: "2027-01-31", today: "2026-10-26" });
  assert.equal(p.direction, "down");
  assert.equal(p.reached, false);
  assert.ok(p.etaDate > "2027-04-01" && p.etaDate < "2027-05-30", p.etaDate);
  near(p.neededKgPerWeek, -0.39, 0.02);
  near(p.neededPct, 0.43, 0.02);
  assert.ok(p.atTargetDate > 88 && p.atTargetDate < 89);
  assert.equal(projection({ current: 85.9, kgPerWeek: -0.2, target: 86, today: "2026-10-26", startKg: 92 }).reached, true, "meta ya alcanzada (y pasada)");
  assert.equal(projection({ current: 86.02, kgPerWeek: -0.2, target: 86, today: "2026-10-26" }).reached, true, "a menos de 50 g: alcanzada");
  assert.equal(projection({ current: 85, kgPerWeek: 0, target: 86, today: "2026-10-26", startKg: 84 }).reached, false, "meta de subir: todavía no");
  assert.equal(projection({ current: 91, kgPerWeek: 0.1, target: 86, today: "2026-10-26" }).etaDate, null, "subiendo: no llega");
  assert.equal(projection({ current: 80, kgPerWeek: 0.2, target: 82, targetDate: "2026-12-31", today: "2026-10-26" }).direction, "up", "también para subir");
});

test("semáforo del ritmo contra 0,25–0,7 % por semana", () => {
  assert.equal(rateStatus(-0.23), "slow");
  assert.equal(rateStatus(-0.41), "healthy");
  assert.equal(rateStatus(-0.9), "fast");
  assert.equal(rateStatus(null), "unknown");
});

test("promedio por semana (lunes a domingo) contra la anterior", () => {
  const rows = weeklyAverages([{ day: "2026-10-19", kg: 91.2 }, { day: "2026-10-23", kg: 90.8 }, { day: "2026-10-13", kg: 91.45 }, { day: "2026-10-26", kg: 90.1 }]);
  assert.deepEqual(rows.map((r) => [r.weekStart, r.avg, r.diff, r.count]), [["2026-10-26", 90.1, -0.9, 1], ["2026-10-19", 91, -0.45, 2], ["2026-10-12", 91.45, null, 1]]);
});

test("aviso de tipeo: salto de más de 3 kg contra la tendencia (no bloquea)", () => {
  assert.deepEqual(typoCheck(81.4, 91.4), { suspicious: true, diff: -10 });
  assert.equal(typoCheck(90.9, 91.4).suspicious, false);
  assert.equal(typoCheck(90, null).suspicious, false);
});

test("medidas: dirección por zona, relaciones y próxima medición", () => {
  const zones = byZone([
    { zone: "cintura", measuredOn: "2026-09-09", valueCm: 98 },
    { zone: "cintura", measuredOn: "2026-10-21", valueCm: 96.5 },
    { zone: "brazo", measuredOn: "2026-09-09", valueCm: 36 },
    { zone: "brazo", measuredOn: "2026-10-21", valueCm: 36.5 },
    { zone: "hombros", measuredOn: "2026-09-09", valueCm: 120 },
    { zone: "hombros", measuredOn: "2026-10-21", valueCm: 121.5 },
    { zone: "muslo", measuredOn: "2026-10-21", valueCm: 59.5 },
  ]);
  assert.equal(zoneTrend(zones.cintura, "down").verdict, "good");
  assert.equal(zoneTrend(zones.brazo, "up").verdict, "good");
  assert.equal(zoneTrend(zones.cintura, "up").verdict, "bad");
  assert.equal(zoneTrend(zones.muslo, "neutral").verdict, "none", "una sola medida");
  assert.equal(zoneTrend([], "up"), null);
  const r = ratios(zones);
  assert.equal(r.shouldersToWaist, 1.26);
  assert.equal(r.shouldersToWaistBefore, 1.22);
  assert.equal(r.waistToHeight, null, "sin altura");
  assert.equal(ratios(zones, 180).waistToHeight, 0.54);
  assert.deepEqual(nextDue("2026-10-21", 14, "2026-10-27"), { date: "2026-11-04", daysLeft: 8, overdue: false, never: false });
  assert.equal(nextDue(null, 14, "2026-10-27").never, true);
  assert.equal(changeBetween(zones.cintura, "2026-09-18", "2026-10-25"), -1.5);
});

test("hábitos: últimos 7 días, racha y el que más se cae", () => {
  const done = ["2026-10-24", "2026-10-25", "2026-10-26"];
  assert.equal(habitStreak(done, "2026-10-27"), 3, "hoy todavía no: cuenta hasta ayer");
  assert.equal(habitStreak([...done, "2026-10-27"], "2026-10-27"), 4);
  assert.equal(habitStreak([], "2026-10-27"), 0);
  assert.equal(lastDays(done, "2026-10-27").filter((d) => d.done).length, 3);
  const s = habitsSummary([{ id: 1, name: "Creatina", doneDays: done.concat("2026-10-27") }, { id: 2, name: "Proteína", doneDays: ["2026-10-25"] }], "2026-10-27");
  assert.equal(s.best.name, "Creatina");
  assert.equal(s.worst.name, "Proteína");
  assert.equal(s.doneToday, 1);
});

test("recomposición: cuatro señales con veredicto en texto", () => {
  const s = recompositionSignals({ weightChange: -0.8, weightPctPerWeek: -0.22, waistChange: -1.5, armChange: 0.5, strengthPct: 4 });
  assert.deepEqual(s.map((x) => x.verdict), ["Bajando, sin apuro", "Se va grasa", "Crece, aun en déficit", "Mantenés músculo (y más fuerte)"]);
  const empty = recompositionSignals({ weightChange: null, waistChange: null, armChange: null, strengthPct: null });
  assert.ok(empty.every((x) => x.tone === "neutral"));
  assert.equal(strengthChange([{ exerciseId: 1, sessions: [{ date: "a", total: 100 }, { date: "b", total: 104 }] }, { exerciseId: 2, sessions: [{ date: "a", total: 50 }] }]), 4);
  assert.equal(strengthChange([]), null);
});

test("formato es-AR: coma decimal y signos", () => {
  assert.equal(num(32.5), "32,5");
  assert.equal(num(91), "91");
  assert.equal(num(91.4, { decimals: 1 }), "91,4");
  assert.equal(signed(-1.5), "−1,5");
  assert.equal(signed(0.5), "+0,5");
  assert.equal(kg(5, { bodyweight: true }), "+5");
  assert.equal(parseNum("32,5"), 32.5);
  assert.equal(parseNum("abc"), null);
  assert.equal(setsLine([{ weightKg: 32.5, reps: 8 }, { weightKg: 32.5, reps: 8 }, { weightKg: 32.5, reps: 7 }]), "32,5 × 8, 8, 7");
});
