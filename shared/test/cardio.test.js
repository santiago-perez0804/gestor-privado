import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, parseDuration, paceSecPerKm, speedKmh, paceText, cardioTotals, cardioLine, cardioRecords, cardioRecordHits, suggestCardio, weeklyCardio } from "../fisico/cardio.js";
import { initWorkout, workoutReducer as r, toSnapshot, elapsedSeconds, fromSavedSession, progress } from "../fisico/workout.js";
import { doneVolume } from "../fisico/volume.js";

const done = (o) => ({ type: "working", completedAt: "2026-10-27T21:00:00Z", ...o });

test("duración: formato y lectura (minutos sueltos, mm:ss, h:mm:ss, coma decimal)", () => {
  assert.equal(duration(1500), "25:00");
  assert.equal(duration(65), "1:05");
  assert.equal(duration(3725), "1:02:05");
  assert.equal(duration(0), "0:00");
  assert.equal(duration(null), "–");
  assert.equal(parseDuration("25"), 1500);
  assert.equal(parseDuration("25:30"), 1530);
  assert.equal(parseDuration("1:05:00"), 3900);
  assert.equal(parseDuration("12,5"), 750);
  assert.equal(parseDuration(" 0:45 "), 45);
  assert.equal(parseDuration("25:75"), null, "segundos fuera de rango");
  assert.equal(parseDuration("abc"), null);
  assert.equal(parseDuration(""), null);
  assert.equal(parseDuration("1:2:3:4"), null);
});

test("ritmo y velocidad: sin distancia no hay ritmo", () => {
  assert.equal(paceSecPerKm(1800, 5), 360);
  assert.equal(paceText(360), "6:00 /km");
  assert.equal(speedKmh(1800, 5), 10);
  assert.equal(paceSecPerKm(1800, null), null);
  assert.equal(paceSecPerKm(0, 3), null);
  assert.equal(paceText(null), "–");
});

test("totales de bloques: tiempo, distancia y conteo suman; nivel es el máximo; lo no hecho no cuenta", () => {
  const t = cardioTotals([done({ durationSeconds: 600, distanceKm: 1.2, level: 6 }), done({ durationSeconds: 600, distanceKm: 1.3, level: 8 }), { durationSeconds: 600, completedAt: null }]);
  assert.deepEqual(t, { blocks: 2, durationSeconds: 1200, distanceKm: 2.5, count: null, level: 8, paceSecPerKm: 480 });
  assert.equal(cardioTotals([{ durationSeconds: 600, completedAt: null }]), null);
  assert.equal(cardioTotals([done({ durationSeconds: 0 })]), null, "sin tiempo no cuenta");
  assert.equal(cardioTotals([done({ durationSeconds: 300, type: "warmup" })]), null, "la entrada en calor no cuenta");
});

test("línea de texto en es-AR con las etiquetas del ejercicio", () => {
  assert.equal(cardioLine({ durationSeconds: 1500, distanceKm: 3.2, level: 8, count: null, blocks: 1 }, { levelLabel: "inclinación" }), "25:00 · 3,2 km · inclinación 8");
  assert.equal(cardioLine({ durationSeconds: 600, count: 1200, blocks: 3 }, { countLabel: "saltos" }), "10:00 · 1.200 saltos · 3 bloques");
  assert.equal(cardioLine(null), "");
});

test("récords de cardio: más tiempo, distancia, mejor ritmo (≥ 1 km) y conteo", () => {
  const sessions = [
    { date: "2026-10-01", sets: [done({ durationSeconds: 1200, distanceKm: 2 })] },
    { date: "2026-10-05", sets: [done({ durationSeconds: 300, distanceKm: 0.8 })] }, // pique corto: no es récord de ritmo
    { date: "2026-10-10", sets: [done({ durationSeconds: 1500, distanceKm: 3, count: 50 })] },
  ];
  const rec = cardioRecords(sessions);
  assert.deepEqual(rec.longest, { value: 1500, date: "2026-10-10", sessionId: null });
  assert.equal(rec.farthest.value, 3);
  assert.equal(rec.bestPace.value, 500);
  assert.equal(rec.bestPace.date, "2026-10-10");
  assert.equal(rec.mostCount.value, 50);
  assert.deepEqual(cardioRecords([]), { longest: null, farthest: null, bestPace: null, mostCount: null });
  // Contra esos récords:
  assert.deepEqual(cardioRecordHits({ durationSeconds: 1600, distanceKm: 3, paceSecPerKm: 533, count: null }, rec), ["longest"]);
  assert.deepEqual(cardioRecordHits({ durationSeconds: 1400, distanceKm: 3.5, paceSecPerKm: 400, count: 60 }, rec), ["farthest", "bestPace", "mostCount"]);
  assert.deepEqual(cardioRecordHits({ durationSeconds: 9999 }, cardioRecords([])), [], "la primera vez no es récord");
  assert.deepEqual(cardioRecordHits(null, rec), []);
});

test("progresión: primera vez, repetir, y subir nivel o +2 min tras llegar dos veces", () => {
  const s = (sec, level = null) => ({ date: "x", sets: [done({ durationSeconds: sec, level })] });
  assert.equal(suggestCardio({ targetMinutes: 20 }, []).kind, "first");
  assert.equal(suggestCardio({ targetMinutes: 20 }, []).durationSeconds, 1200);
  assert.equal(suggestCardio({ targetMinutes: 20 }, [s(1200)]).kind, "repeat", "una sola vez no alcanza");
  assert.equal(suggestCardio({ targetMinutes: 20 }, [s(1200), s(1000)]).kind, "repeat");
  const up = suggestCardio({ targetMinutes: 20 }, [s(1200), s(1260)]);
  assert.deepEqual([up.kind, up.targetMinutes, up.durationSeconds], ["increase", 22, 1320]);
  const lvl = suggestCardio({ targetMinutes: 20 }, [s(1200, 7), s(1200, 7)], { hasLevel: true });
  assert.deepEqual([lvl.kind, lvl.targetMinutes, lvl.level], ["increase", 20, 8]);
  // Con nivel pero sin haberlo anotado: suma minutos.
  assert.equal(suggestCardio({ targetMinutes: 20 }, [s(1200), s(1200)], { hasLevel: true }).targetMinutes, 22);
  // Sin objetivo: repetir lo de la última vez.
  const free = suggestCardio({}, [s(900)]);
  assert.deepEqual([free.kind, free.durationSeconds], ["repeat", 900]);
});

test("minutos de la semana contra el objetivo, con desglose", () => {
  const w = weeklyCardio(
    [
      { exerciseId: 1, name: "Caminata", durationSeconds: 1800 },
      { exerciseId: 2, name: "Saltar la cuerda", durationSeconds: 600 },
      { exerciseId: 1, name: "Caminata", durationSeconds: 2400 },
      { exerciseId: 3, name: "Bici", durationSeconds: 0 },
    ],
    150
  );
  assert.equal(w.minutes, 80);
  assert.deepEqual([w.goal, w.pct, w.missing, w.reached], [150, 53, 70, false]);
  assert.deepEqual(w.byActivity, [{ exerciseId: 1, name: "Caminata", minutes: 70 }, { exerciseId: 2, name: "Saltar la cuerda", minutes: 10 }]);
  assert.equal(weeklyCardio([{ exerciseId: 1, name: "x", durationSeconds: 200 * 60 }], 150).pct, 100, "tope en 100 %");
  assert.equal(weeklyCardio([], 0).goal, null, "sin objetivo");
});

// ---------- entreno en vivo con cardio ----------
let n = 0;
const newId = () => `id${++n}`;
const T0 = Date.parse("2026-10-27T21:00:00Z");
const rope = {
  exerciseId: 70,
  exercise: { name: "Saltar la cuerda", kind: "cardio", equipment: "otro", muscles: [], cardioFields: ["count"], countLabel: "saltos" },
  prescription: { sets: 2, targetMinutes: 10, restSeconds: 0 },
  previous: null,
  suggestion: { kind: "first", durationSeconds: 600, level: null },
  cardioRecords: { longest: { value: 400, date: "2026-10-20" }, farthest: null, bestPace: null, mostCount: null },
};
const curl = { exerciseId: 5, exercise: { name: "Curl", equipment: "barra", isBodyweight: false, muscles: [{ muscle: "biceps", role: "primary" }] }, prescription: { sets: 1, repMin: 8, repMax: 10, restSeconds: 90 }, previous: null, suggestion: { weightKg: 30, targetReps: [8] }, records: { bestE1rm: null, byReps: {} } };
const start = () => initWorkout({ session: { id: "s1", title: "Cardio + curl" }, exercises: [rope, curl], settings: {} }, { now: T0, newId });

test("cardio en vivo: bloques con el tiempo objetivo repartido, sin kg ni reps", () => {
  const s = start();
  const blocks = s.sets.filter((x) => x.exerciseId === 70);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((b) => [b.durationSeconds, b.weightKg, b.reps]), [[300, null, null], [300, null, null]]);
  assert.equal(progress(s).total, 3);
});

test("cronómetro: arranca de cero, suma al pausar, sobrevive al reloj y frena al tildar", () => {
  let s = start();
  const b = s.sets[0];
  s = r(s, { type: "timerToggle", setId: b.id, now: T0 });
  let cur = s.sets[0];
  assert.equal(cur.durationSeconds, 0, "la primera vez arranca de cero (no del objetivo)");
  assert.equal(elapsedSeconds(cur, T0 + 90_000), 90, "se calcula con el reloj, no con un contador");
  s = r(s, { type: "timerToggle", setId: b.id, now: T0 + 120_000 });
  assert.deepEqual([s.sets[0].durationSeconds, s.sets[0].timerStartedAt], [120, null]);
  s = r(s, { type: "timerToggle", setId: b.id, now: T0 + 200_000 }); // sigue desde 120
  // Arrancar otro cronómetro frena el primero.
  s = r(s, { type: "timerToggle", setId: s.sets[1].id, now: T0 + 230_000 });
  assert.deepEqual([s.sets[0].durationSeconds, s.sets[0].timerStartedAt], [150, null]);
  assert.equal(s.sets[1].timerStartedAt, T0 + 230_000);
  // Tildar con el cronómetro andando: guarda lo corrido. Sin descanso automático en cardio.
  s = r(s, { type: "toggleDone", setId: s.sets[1].id, now: T0 + 290_000 });
  assert.deepEqual([s.sets[1].durationSeconds, s.sets[1].timerStartedAt], [60, null]);
  assert.equal(s.rest, null);
  // Un tildado no se puede cronometrar.
  assert.equal(r(s, { type: "timerToggle", setId: s.sets[1].id, now: T0 + 300_000 }), s);
});

test("corregir el tiempo a mano (mm:ss) con el cronómetro andando sigue desde el valor nuevo", () => {
  let s = start();
  const id = s.sets[0].id;
  s = r(s, { type: "timerToggle", setId: id, now: T0 });
  s = r(s, { type: "edit", setId: id, field: "durationSeconds", value: 500, now: T0 + 10_000 });
  assert.equal(elapsedSeconds(s.sets[0], T0 + 20_000), 510);
});

test("récord de cardio en vivo (más tiempo que el histórico) y se va al destildar", () => {
  let s = start();
  const [a, b] = s.sets;
  s = r(s, { type: "toggleDone", setId: a.id, now: T0 + 1000 }); // 300 s < 400
  assert.equal(s.prs.length, 0);
  s = r(s, { type: "toggleDone", setId: b.id, now: T0 + 2000 }); // 600 s en total > 400
  assert.deepEqual(s.prs.map((p) => p.cardio), [["longest"]]);
  s = r(s, { type: "toggleDone", setId: b.id, now: T0 + 3000 });
  assert.equal(s.prs.length, 0);
});

test("snapshot con los datos de cardio y retomar desde el server los conserva", () => {
  let s = start();
  const id = s.sets[0].id;
  s = r(s, { type: "edit", setId: id, field: "count", value: 900, now: T0 + 1000 });
  s = r(s, { type: "toggleDone", setId: id, now: T0 + 2000 });
  const snap = toSnapshot(s);
  const row = snap.sets.find((x) => x.id === id);
  assert.deepEqual([row.durationSeconds, row.count, row.distanceKm, row.weightKg], [300, 900, null, null]);
  const back = fromSavedSession({ exercises: [rope, curl] }, { ...snap, sets: snap.sets }, new Map(), { newId });
  const again = back.sets.find((x) => x.id === id);
  assert.deepEqual([again.durationSeconds, again.count, again.timed], [300, 900, true]);
});

test("agregar un bloque copia el tiempo y el nivel del anterior", () => {
  let s = start();
  const key = s.exercises[0].key;
  s = r(s, { type: "edit", setId: s.sets[1].id, field: "level", value: 7, now: T0 });
  s = r(s, { type: "addSet", exerciseKey: key, id: "extra", now: T0 });
  const extra = s.sets.find((x) => x.id === "extra");
  assert.deepEqual([extra.durationSeconds, extra.level, extra.weightKg], [300, 7, null]);
  assert.equal(s.sets.indexOf(extra), 2, "va al final de su ejercicio");
});

test("el cardio no suma volumen por músculo", () => {
  const ex = new Map([[70, { muscles: [] }], [5, { muscles: [{ muscle: "biceps", role: "primary" }] }]]);
  assert.deepEqual(doneVolume([done({ exerciseId: 70, durationSeconds: 600 }), done({ exerciseId: 5, reps: 8 })], ex), { biceps: 1 });
});
