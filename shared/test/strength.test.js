import { test } from "node:test";
import assert from "node:assert/strict";
import { epley, setE1rm, exerciseRecords, detectRecord, e1rmHistory, e1rmChangePct, countsAsWork, MAX_EPLEY_REPS } from "../fisico/strength.js";
import { suggestNext, workingWeight, belowMin } from "../fisico/progression.js";
import { platesPerSide } from "../fisico/plates.js";

const near = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("Epley: peso × (1 + reps/30), solo de 1 a 12 reps", () => {
  near(epley(32.5, 8), 41.17);
  near(epley(100, 1), 103.33);
  assert.equal(epley(60, MAX_EPLEY_REPS + 1), null, "más de 12 reps: no se estima");
  assert.equal(epley(60, 0), null);
  assert.equal(epley(0, 8), null, "sin peso no hay 1RM");
  assert.equal(setE1rm({ weightKg: 32.5, reps: 8 }).value, 41.2);
});

test("peso corporal: (cuerpo + lastre) y el resultado como lastre equivalente", () => {
  // Dominadas +5 kg × 6 pesando 91 kg → (96 × 1,2) − 91 = 24,2 kg de lastre equivalente.
  assert.deepEqual(setE1rm({ weightKg: 5, reps: 6 }, { isBodyweight: true, bodyweightKg: 91 }), { value: 24.2, bodyweight: true });
  assert.equal(setE1rm({ weightKg: 0, reps: 10 }, { isBodyweight: true, bodyweightKg: 91 }).value, 30.3, "sin lastre también");
  assert.equal(setE1rm({ weightKg: 5, reps: 6 }, { isBodyweight: true }), null, "sin peso corporal del día no se puede");
  assert.equal(setE1rm({ weightKg: 5, reps: 15 }, { isBodyweight: true, bodyweightKg: 91 }), null, "más de 12 reps");
});

test("récords: mejor 1RM y mejor peso por cantidad de reps (con fecha y sesión)", () => {
  const sets = [
    { weightKg: 30, reps: 8, date: "2026-09-15", sessionId: "a" },
    { weightKg: 30, reps: 9, date: "2026-09-29", sessionId: "b" },
    { weightKg: 32.5, reps: 7, date: "2026-10-06", sessionId: "c" },
    { weightKg: 32.5, reps: 8, date: "2026-10-20", sessionId: "d" },
    { weightKg: 20, reps: 15, date: "2026-10-20", sessionId: "d" }, // > 12: cuenta para "por reps", no para 1RM
  ];
  const r = exerciseRecords(sets);
  assert.equal(r.bestE1rm.value, 41.2);
  assert.equal(r.bestE1rm.sessionId, "d");
  assert.deepEqual(r.byReps[7], { weightKg: 32.5, date: "2026-10-06", sessionId: "c" });
  assert.deepEqual(r.byReps[15], { weightKg: 20, date: "2026-10-20", sessionId: "d" });
  assert.deepEqual(exerciseRecords([]), { bestE1rm: null, byReps: {} });
});

test("récord en vivo: supera el 1RM o el peso para esas reps; la primera vez no es récord", () => {
  const records = exerciseRecords([{ weightKg: 32.5, reps: 8, date: "2026-10-20" }]);
  assert.deepEqual(detectRecord({ weightKg: 32.5, reps: 9 }, records), { e1rm: true, reps: false, e1rmValue: 42.3 });
  assert.equal(detectRecord({ weightKg: 35, reps: 8 }, records).reps, true);
  assert.equal(detectRecord({ weightKg: 32.5, reps: 8 }, records).e1rm, false, "igualar no es récord");
  assert.equal(detectRecord({ weightKg: 30, reps: 13 }, records).e1rm, false, "más de 12 reps no compite por 1RM");
  assert.deepEqual(detectRecord({ weightKg: 50, reps: 5 }, { bestE1rm: null, byReps: {} }), { e1rm: false, reps: false, e1rmValue: 58.3 });
});

test("historial por sesión con marca de récord y % de cambio (peso corporal sobre la carga total)", () => {
  const h = e1rmHistory([
    { date: "2026-09-15", sets: [{ weightKg: 30, reps: 8 }] },
    { date: "2026-09-22", sets: [{ weightKg: 30, reps: 8 }] },
    { date: "2026-09-29", sets: [{ weightKg: 30, reps: 9 }, { weightKg: 30, reps: 8 }] },
    { date: "2026-10-20", sets: [{ weightKg: 32.5, reps: 8 }] },
  ]);
  assert.deepEqual(h.map((x) => x.record), [true, false, true, true]);
  assert.equal(e1rmChangePct(h), 8.4);
  const bw = e1rmHistory([{ date: "a", sets: [{ weightKg: 5, reps: 6, bodyweightKg: 91 }] }, { date: "b", sets: [{ weightKg: 10, reps: 6, bodyweightKg: 91 }] }], { isBodyweight: true });
  assert.equal(e1rmChangePct(bw), 5.2, "1RM total de 115,2 a 121,2 kg (no +25 % del lastre)");
  assert.equal(e1rmChangePct([{ total: null }]), null);
});

test("solo cuentan las series de trabajo completadas", () => {
  assert.equal(countsAsWork({ type: "working", completedAt: "x", reps: 8 }), true);
  assert.equal(countsAsWork({ type: "warmup", completedAt: "x", reps: 10 }), false);
  assert.equal(countsAsWork({ type: "working", completedAt: null, reps: 8 }), false);
});

test("doble progresión: subir, +1 rep en la más floja, o bajar tras dos sesiones flojas", () => {
  const p = { sets: 3, repMin: 6, repMax: 8 };
  const s = (w, ...reps) => reps.map((r) => ({ weightKg: w, reps: r }));
  assert.equal(suggestNext(p, []).kind, "start");
  const inc = suggestNext(p, [{ date: "d", sets: s(32.5, 8, 8, 8) }], { stepKg: 2.5 });
  assert.deepEqual([inc.kind, inc.weightKg, inc.targetReps], ["increase", 35, [6, 6, 6]]);
  const reps = suggestNext(p, [{ date: "d", sets: s(32.5, 8, 8, 7) }]);
  assert.deepEqual([reps.kind, reps.weightKg, reps.targetReps], ["reps", 32.5, [8, 8, 8]]);
  assert.deepEqual(reps.previous, { date: "d", weightKg: 32.5, reps: [8, 8, 7] });
  const dec = suggestNext(p, [{ date: "2", sets: s(40, 5, 4, 4) }, { date: "1", sets: s(40, 5, 5, 4) }], { stepKg: 2.5 });
  assert.deepEqual([dec.kind, dec.weightKg], ["decrease", 37.5]);
  assert.equal(suggestNext(p, [{ date: "2", sets: s(40, 5, 4, 4) }]).kind, "reps", "una sola sesión floja no alcanza para bajar");
  assert.equal(suggestNext(p, [{ date: "d", sets: s(30, 8, 8) }]).kind, "reps", "menos series que las planificadas: no sube");
  const dumbbell = suggestNext({ sets: 3, repMin: 10, repMax: 12 }, [{ date: "d", sets: s(12, 12, 12, 12) }], { stepKg: 2 });
  assert.equal(dumbbell.weightKg, 14, "mancuernas: +2 kg");
  const bw = suggestNext({ sets: 3, repMin: 5, repMax: 7 }, [{ date: "d", sets: s(5, 6, 6, 5) }]);
  assert.deepEqual([bw.weightKg, bw.targetReps], [5, [6, 6, 6]], "peso corporal: el lastre se mantiene");
  assert.equal(workingWeight(s(30, 8).concat(s(32.5, 8, 8))), 32.5);
  assert.equal(belowMin(s(40, 5, 4, 7), 6), true);
});

test("discos por lado: exacto con los que hay, o lo más cercano por debajo", () => {
  const plates = { 25: 2, 20: 2, 15: 1, 10: 2, 5: 2, 2.5: 2, 1.25: 2 };
  assert.deepEqual(platesPerSide(32.5, 10, plates).perSide, [10, 1.25], "curl con barra Z: 10 + 1,25");
  assert.deepEqual(platesPerSide(100, 20, plates).perSide, [25, 15]);
  assert.deepEqual(platesPerSide(20, 20, plates).perSide, []);
  const limited = platesPerSide(80, 20, { 20: 1, 15: 2 });
  assert.deepEqual(limited.perSide, [15, 15], "con un solo 20 por lado, dos de 15");
  const short = platesPerSide(61, 20, plates);
  assert.equal(short.exact, false);
  assert.equal(short.loadedKg, 60);
  assert.equal(short.remainderKg, 1);
  assert.equal(platesPerSide(15, 20, plates).belowBar, true);
});
