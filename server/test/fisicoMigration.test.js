import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sharedSchema } from "../src/db/schema/shared.js";
import { fisicoSchema } from "../src/db/schema/fisico.js";
import { fisicoSchemaV1 } from "./fixtures/fisicoSchemaV1.js";
import { migrateFisicoV2, describeFisicoMigration } from "../src/db/migrations/fisicoV2.js";
import { FISICO_EXERCISES } from "../src/db/seeds/fisicoExercises.js";
import { MUSCLE_IDS, EQUIPMENT_IDS } from "../../shared/fisico/constants.js";

const ts = "2026-10-01T10:00:00.000Z";

/** Base como estaba antes del rediseño, con datos parecidos a los reales. */
function oldDatabase(dir) {
  const db = new DatabaseSync(join(dir, "fisico.db"));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(sharedSchema);
  db.exec(fisicoSchemaV1);
  const w = db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (?, ?, ?)");
  w.run(91.8, "2026-10-01T21:39", ts);
  w.run(90.9, "2026-10-22T12:47", ts);
  w.run(90.1, "2026-10-26T23:08", ts);
  db.prepare("INSERT INTO plans (name, description, createdAt, updatedAt) VALUES ('PPL', 'Push / Pull / Legs / Push / Pull', ?, ?)").run(ts, ts);
  db.prepare("INSERT INTO settings (key, value) VALUES ('weight_goal_kg', '86')").run();
  const m = db.prepare("INSERT INTO body_measurements (type, value, date, notes, createdAt) VALUES (?, ?, ?, ?, ?)");
  m.run("brazo", 36, "2026-09-09", null, ts);
  m.run("cintura", 98, "2026-09-09", "en ayunas", ts);
  m.run("cintura", 97.5, "2026-09-09", null, ts); // misma zona el mismo día: no se pierde
  m.run("cadera", 104, "2026-09-23", null, ts); // zona vieja: se conserva
  const publicDir = join(dir, "photos");
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, "abc.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  const p = db.prepare("INSERT INTO progress_photos (date, fileName, notes, createdAt) VALUES (?, ?, ?, ?)");
  p.run("2026-09-18", "abc.jpg", "frente", ts);
  p.run("2026-10-02", "se-perdio.jpg", null, ts); // archivo inexistente
  // Lo que hace el server al arrancar: el esquema nuevo (CREATE IF NOT EXISTS) antes de migrar.
  db.exec(fisicoSchema);
  return { db, publicDir, privateDir: join(dir, "private", "photos"), backupsDir: join(dir, "backups") };
}

test("migra una base vieja sin perder nada y con resumen", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "fisico-mig-"));
  const { db, publicDir, privateDir, backupsDir } = oldDatabase(dir);
  t.after(() => (db.close(), rmSync(dir, { recursive: true, force: true })));
  const s = migrateFisicoV2(db, { backupsDir, publicPhotosDir: publicDir, privatePhotosDir: privateDir, now: new Date("2026-10-27T12:00:00Z") });

  assert.equal(s.ran, true);
  assert.ok(existsSync(s.backupPath), "backup antes de tocar nada");
  assert.equal(s.totals.weighIns, 3, "pesadas intactas");
  assert.deepEqual(db.prepare("SELECT weight FROM weights ORDER BY recordedAt").all().map((r) => r.weight), [91.8, 90.9, 90.1]);
  assert.equal(s.exercisesSeeded, FISICO_EXERCISES.length);
  assert.equal(s.habitsSeeded, 5);
  assert.equal(s.weightGoal, 86);
  assert.equal(db.prepare("SELECT target FROM goals WHERE type = 'weight'").get().target, 86);

  const plan = db.prepare("SELECT * FROM plans").get();
  assert.equal(plan.isActive, 1);
  assert.equal(plan.progressionRule, "double_progression");
  assert.deepEqual(JSON.parse(plan.priorityMuscles), ["biceps", "pecho"]);
  assert.deepEqual(JSON.parse(plan.dailyExtras), ["caminata"]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM routines").get().n, 0, "no inventa rutinas");
  const schedule = db.prepare("SELECT weekday, routineId, extras FROM plan_schedule ORDER BY weekday").all();
  assert.equal(schedule.length, 7);
  assert.deepEqual(JSON.parse(schedule[1].extras), ["calistenia"], "martes");
  assert.deepEqual(JSON.parse(schedule[5].extras), ["bici"], "sábado");
  assert.ok(schedule.every((d) => d.routineId === null));

  assert.equal(s.measurements, 4);
  assert.equal(s.measurementSessions, 3, "09-09 (dos por la cintura repetida) y 09-23");
  assert.deepEqual(db.prepare("SELECT zone, valueCm FROM measurements ORDER BY id").all().map((r) => [r.zone, r.valueCm]), [["brazo", 36], ["cintura", 98], ["cintura", 97.5], ["cadera", 104]]);
  assert.match(db.prepare("SELECT notes FROM measurement_sessions WHERE id = 1").get().notes, /ayunas/);

  assert.equal(s.photos, 1);
  assert.equal(s.photosMissing, 1);
  const photo = db.prepare("SELECT * FROM photos").get();
  assert.equal(photo.pose, "front");
  assert.notEqual(photo.fileKey, "abc.jpg", "nombre nuevo, aleatorio");
  assert.ok(existsSync(join(privateDir, photo.fileKey)), "en la carpeta privada");
  assert.equal(existsSync(join(publicDir, "abc.jpg")), false, "ya no está en la pública");

  assert.ok(db.prepare("PRAGMA table_info(routine_exercises)").all().some((c) => c.name === "exerciseId"), "routine_exercises con la forma nueva");
  assert.ok(db.prepare("PRAGMA table_info(weights)").all().some((c) => c.name === "note"));
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.match(describeFisicoMigration(s), /3 pesadas intactas/);

  // Segunda vez: no hace nada (ni backup).
  const again = migrateFisicoV2(db, { backupsDir, publicPhotosDir: publicDir, privatePhotosDir: privateDir, now: new Date("2026-10-27T13:00:00Z") });
  assert.equal(again.ran, false);
  assert.equal(readdirSync(backupsDir).length, 1);
  assert.equal(again.totals.measurements, 4);
  assert.match(describeFisicoMigration(again), /nada para migrar/);
});

test("base nueva: crea todo y la segunda vez no hace nada; lo borrado no vuelve", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "fisico-new-"));
  const db = new DatabaseSync(join(dir, "fisico.db"));
  t.after(() => (db.close(), rmSync(dir, { recursive: true, force: true })));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(sharedSchema);
  db.exec(fisicoSchema);
  const s = migrateFisicoV2(db, { backupsDir: join(dir, "backups"), privatePhotosDir: join(dir, "private") });
  assert.equal(s.ran, true);
  assert.equal(s.activePlan, null, "sin planes no hay plan activo");
  assert.equal(s.totals.exercises, FISICO_EXERCISES.length);
  db.prepare("DELETE FROM habits WHERE name = 'Agua'").run();
  const again = migrateFisicoV2(db, { backupsDir: join(dir, "backups") });
  assert.equal(again.ran, false);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM habits").get().n, 4, "un hábito borrado no se vuelve a crear");
});

test("ejercicios de rutina viejos (si los hubiera) quedan como respaldo", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "fisico-re-"));
  const db = new DatabaseSync(join(dir, "fisico.db"));
  t.after(() => (db.close(), rmSync(dir, { recursive: true, force: true })));
  db.exec(sharedSchema);
  db.exec(fisicoSchemaV1);
  db.prepare("INSERT INTO plans (name, createdAt, updatedAt) VALUES ('X', ?, ?)").run(ts, ts);
  db.prepare("INSERT INTO routines (planId, name, createdAt, updatedAt) VALUES (1, 'Push', ?, ?)").run(ts, ts);
  db.prepare("INSERT INTO exercise_library (id, name, primaryMuscles, secondaryMuscles, instructions) VALUES ('Bench', 'Bench', '[]', '[]', '[]')").run();
  db.prepare("INSERT INTO routine_exercises (routineId, exerciseLibraryId, targetSets, createdAt, updatedAt) VALUES (1, 'Bench', 3, ?, ?)").run(ts, ts);
  db.exec(fisicoSchema);
  const s = migrateFisicoV2(db, {});
  assert.equal(s.routineExercisesKeptAsLegacy, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM routine_exercises_legacy").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM routine_exercises").get().n, 0);
});

test("la biblioteca semilla usa solo músculos y equipos conocidos, sin nombres repetidos", () => {
  const names = new Set();
  for (const e of FISICO_EXERCISES) {
    assert.ok(EQUIPMENT_IDS.includes(e.equipment), e.name);
    assert.ok(e.muscles.length > 0 && e.muscles.some((m) => m.role === "primary"), e.name);
    for (const m of e.muscles) assert.ok(MUSCLE_IDS.includes(m.muscle), `${e.name}: ${m.muscle}`);
    assert.ok(!names.has(e.name.toLowerCase()), `repetido: ${e.name}`);
    names.add(e.name.toLowerCase());
  }
  assert.ok(FISICO_EXERCISES.length >= 60);
});
