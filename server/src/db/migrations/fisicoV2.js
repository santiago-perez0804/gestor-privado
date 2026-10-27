// Migración de Físico al modelo del rediseño. Idempotente: se puede correr las veces que haga falta.
// - Lo de una sola vez (biblioteca semilla, hábitos, meta, valores del plan) queda marcado en
//   settings "fisico.schemaVersion" para no repetirse aunque después borres algo.
// - Medidas y fotos viejas se copian recordando de qué fila vinieron (legacyId).
// - Las tablas viejas no se borran: quedan como respaldo.
// Antes de tocar datos hace un backup de la base.
import { join } from "node:path";
import { existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { FISICO_EXERCISES } from "../seeds/fisicoExercises.js";

export const FISICO_SCHEMA_VERSION = 2;

const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const tableExists = (db, name) => !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
const ensureColumn = (db, table, column, ddl) => {
  if (!columns(db, table).includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
};
const setting = (db, key) => db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
const putSetting = (db, key, value) =>
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));

const HABITS = [
  ["Proteína", "160 g por día"],
  ["Creatina", "5 g"],
  ["Agua", "3 litros"],
  ["Caminata", "8.000 pasos"],
  ["Dormir antes de las 0", "para levantarte 7 h después"],
];

/** Columnas nuevas en tablas que ya existían (siempre; es idempotente). */
function ensureColumns(db) {
  ensureColumn(db, "weights", "note", "TEXT");
  ensureColumn(db, "plans", "goal", "TEXT");
  ensureColumn(db, "plans", "startDate", "TEXT");
  ensureColumn(db, "plans", "weeks", "INTEGER");
  ensureColumn(db, "plans", "deloadWeek", "INTEGER");
  ensureColumn(db, "plans", "progressionRule", "TEXT NOT NULL DEFAULT 'double_progression'");
  ensureColumn(db, "plans", "priorityMuscles", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "plans", "dailyExtras", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "plans", "isActive", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "routines", "color", "TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise ON routine_exercises(exerciseId)");
}

/** Fotos viejas cuyo archivo ya no existía: se anotan para no reintentarlas en cada arranque. */
function missingPhotoIds(db) {
  try {
    return new Set(JSON.parse(setting(db, "fisico.legacyPhotosMissing") || "[]"));
  } catch {
    return new Set();
  }
}

/** ¿Hay algo para migrar? (para hacer backup solo si hace falta). */
function pendingWork(db) {
  const oldRoutineExercises = columns(db, "routine_exercises").includes("exerciseLibraryId");
  const measurements = tableExists(db, "body_measurements")
    ? db.prepare("SELECT COUNT(*) AS n FROM body_measurements WHERE id NOT IN (SELECT legacyId FROM measurements WHERE legacyId IS NOT NULL)").get().n
    : 0;
  const skipped = missingPhotoIds(db);
  const photos = tableExists(db, "progress_photos")
    ? db.prepare("SELECT id FROM progress_photos WHERE id NOT IN (SELECT legacyId FROM photos WHERE legacyId IS NOT NULL)").all().filter((r) => !skipped.has(r.id)).length
    : 0;
  const oneTime = Number(setting(db, "fisico.schemaVersion") || 0) < FISICO_SCHEMA_VERSION;
  return { oldRoutineExercises, measurements, photos, oneTime, any: oldRoutineExercises || measurements > 0 || photos > 0 || oneTime };
}

function backup(db, backupsDir, now) {
  if (!backupsDir) return null;
  mkdirSync(backupsDir, { recursive: true });
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const path = join(backupsDir, `fisico-${stamp}-antes-fisico-v2.db`);
  if (!existsSync(path)) db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  return path;
}

/** La tabla vieja apuntaba a la biblioteca en inglés: se reconstruye con la forma nueva. */
function rebuildRoutineExercises(db, summary) {
  const n = db.prepare("SELECT COUNT(*) AS n FROM routine_exercises").get().n;
  if (n > 0) {
    db.exec("ALTER TABLE routine_exercises RENAME TO routine_exercises_legacy");
    summary.routineExercisesKeptAsLegacy = n;
  } else db.exec("DROP TABLE routine_exercises");
  db.exec(`
    CREATE TABLE routine_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routineId INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
      exerciseId INTEGER NOT NULL REFERENCES exercises(id),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      sets INTEGER NOT NULL DEFAULT 3 CHECK(sets BETWEEN 1 AND 20),
      repMin INTEGER NOT NULL DEFAULT 8 CHECK(repMin BETWEEN 1 AND 100),
      repMax INTEGER NOT NULL DEFAULT 12 CHECK(repMax >= repMin AND repMax <= 100),
      restSeconds INTEGER NOT NULL DEFAULT 120 CHECK(restSeconds BETWEEN 0 AND 1800),
      rirMin REAL,
      rirMax REAL,
      supersetGroup TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_routine_exercises_routineId ON routine_exercises(routineId);
  `);
}

/** Medidas viejas → una sesión de medición por fecha. */
function migrateMeasurements(db, ts, summary) {
  const rows = db.prepare("SELECT * FROM body_measurements WHERE id NOT IN (SELECT legacyId FROM measurements WHERE legacyId IS NOT NULL) ORDER BY date, id").all();
  const sessionFor = new Map();
  const findSession = db.prepare("SELECT id FROM measurement_sessions WHERE measuredOn = ? ORDER BY id LIMIT 1");
  const newSession = db.prepare("INSERT INTO measurement_sessions (measuredOn, notes, createdAt) VALUES (?, NULL, ?)");
  const insert = db.prepare("INSERT INTO measurements (sessionId, measuredOn, zone, valueCm, legacyId, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
  for (const r of rows) {
    const day = String(r.date).slice(0, 10);
    let sessionId = sessionFor.get(day) ?? findSession.get(day)?.id;
    // Dos valores de la misma zona el mismo día: el segundo va a otra sesión (no se pierde).
    if (sessionId && db.prepare("SELECT 1 FROM measurements WHERE sessionId = ? AND zone = ?").get(sessionId, r.type)) sessionId = null;
    if (!sessionId) {
      sessionId = Number(newSession.run(day, ts).lastInsertRowid);
      summary.measurementSessions += 1;
    }
    sessionFor.set(day, sessionId);
    insert.run(sessionId, day, r.type, r.value, r.id, ts);
    if (r.notes) db.prepare("UPDATE measurement_sessions SET notes = COALESCE(notes || ' · ', '') || ? WHERE id = ?").run(r.notes, sessionId);
    summary.measurements += 1;
  }
}

/** Fotos viejas → sesiones por fecha (pose frente, relajado) y archivos a la carpeta privada. */
function migratePhotos(db, ts, summary, { publicPhotosDir, privatePhotosDir }) {
  const skipped = missingPhotoIds(db);
  const rows = db.prepare("SELECT * FROM progress_photos WHERE id NOT IN (SELECT legacyId FROM photos WHERE legacyId IS NOT NULL) ORDER BY date, id").all().filter((r) => !skipped.has(r.id));
  if (!rows.length) return;
  mkdirSync(privatePhotosDir, { recursive: true });
  const sessionFor = new Map();
  for (const r of rows) {
    const from = publicPhotosDir ? join(publicPhotosDir, r.fileName) : null;
    if (!from || !existsSync(from)) {
      summary.photosMissing += 1;
      skipped.add(r.id);
      putSetting(db, "fisico.legacyPhotosMissing", JSON.stringify([...skipped]));
      continue;
    }
    const ext = (r.fileName.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg").toLowerCase();
    const key = `${randomUUID()}${ext}`;
    try {
      renameSync(from, join(privatePhotosDir, key));
    } catch {
      copyFileSync(from, join(privatePhotosDir, key));
      unlinkSync(from);
    }
    const day = String(r.date).slice(0, 10);
    let sessionId = sessionFor.get(day);
    if (!sessionId) {
      sessionId = Number(db.prepare("INSERT INTO photo_sessions (date, note, createdAt) VALUES (?, ?, ?)").run(day, r.notes ?? null, ts).lastInsertRowid);
      sessionFor.set(day, sessionId);
      summary.photoSessions += 1;
    }
    db.prepare("INSERT INTO photos (sessionId, pose, variant, fileKey, thumbKey, note, legacyId, createdAt) VALUES (?, 'front', 'relaxed', ?, NULL, ?, ?, ?)").run(sessionId, key, r.notes ?? null, r.id, ts);
    summary.photos += 1;
  }
}

/** Lo que se hace una sola vez: biblioteca, hábitos, meta de peso y valores del plan activo. */
function oneTimeSetup(db, ts, summary) {
  const insertExercise = db.prepare(
    `INSERT OR IGNORE INTO exercises (name, equipment, bar, isBodyweight, muscles, notes, isCustom, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );
  for (const e of FISICO_EXERCISES) summary.exercisesSeeded += insertExercise.run(e.name, e.equipment, e.bar, e.isBodyweight ? 1 : 0, JSON.stringify(e.muscles), e.notes, ts, ts).changes;

  if (!db.prepare("SELECT COUNT(*) AS n FROM habits").get().n) {
    const insertHabit = db.prepare("INSERT INTO habits (name, targetLabel, sortOrder, archived, createdAt) VALUES (?, ?, ?, 0, ?)");
    HABITS.forEach(([name, target], i) => insertHabit.run(name, target, i, ts));
    summary.habitsSeeded = HABITS.length;
  }

  const goalKg = Number(setting(db, "weight_goal_kg"));
  if (goalKg > 0 && !db.prepare("SELECT 1 FROM goals WHERE type = 'weight'").get()) {
    db.prepare("INSERT INTO goals (type, target, targetDate, createdAt, updatedAt) VALUES ('weight', ?, NULL, ?, ?)").run(goalKg, ts, ts);
    summary.weightGoal = goalKg;
  }

  // Plan activo: el más reciente si ninguno lo está. Con el contexto de uso: doble progresión,
  // prioridad bíceps y después pecho, caminata diaria, calistenia mar/jue y bici el sábado
  // (actividades de la agenda, no rutinas: las rutinas las carga el usuario).
  if (!db.prepare("SELECT 1 FROM plans WHERE isActive = 1").get()) {
    const plan = db.prepare("SELECT id, name FROM plans ORDER BY createdAt DESC, id DESC LIMIT 1").get();
    if (plan) {
      db.prepare(
        `UPDATE plans SET isActive = 1, progressionRule = 'double_progression',
           priorityMuscles = CASE WHEN priorityMuscles = '[]' THEN ? ELSE priorityMuscles END,
           dailyExtras = CASE WHEN dailyExtras = '[]' THEN ? ELSE dailyExtras END, updatedAt = ? WHERE id = ?`
      ).run(JSON.stringify(["biceps", "pecho"]), JSON.stringify(["caminata"]), ts, plan.id);
      const extras = { 2: ["calistenia"], 4: ["calistenia"], 6: ["bici"] };
      const upsert = db.prepare("INSERT OR IGNORE INTO plan_schedule (planId, weekday, routineId, extras) VALUES (?, ?, NULL, ?)");
      for (let d = 1; d <= 7; d++) upsert.run(plan.id, d, JSON.stringify(extras[d] || []));
      summary.activePlan = plan.name;
    }
  }
  putSetting(db, "fisico.schemaVersion", FISICO_SCHEMA_VERSION);
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ backupsDir?: string, publicPhotosDir?: string, privatePhotosDir?: string, now?: Date }} [options]
 */
export function migrateFisicoV2(db, { backupsDir, publicPhotosDir, privatePhotosDir, now = new Date() } = {}) {
  const summary = {
    ran: false,
    backupPath: null,
    exercisesSeeded: 0,
    habitsSeeded: 0,
    weightGoal: null,
    activePlan: null,
    measurements: 0,
    measurementSessions: 0,
    photos: 0,
    photoSessions: 0,
    photosMissing: 0,
    routineExercisesRebuilt: false,
    routineExercisesKeptAsLegacy: 0,
    totals: null,
  };
  const pending = pendingWork(db);
  if (pending.any) {
    summary.ran = true;
    summary.backupPath = backup(db, backupsDir, now);
    const ts = now.toISOString();
    db.exec("BEGIN");
    try {
      if (pending.oldRoutineExercises) {
        rebuildRoutineExercises(db, summary);
        summary.routineExercisesRebuilt = true;
      }
      ensureColumns(db);
      if (pending.oneTime) oneTimeSetup(db, ts, summary);
      if (pending.measurements) migrateMeasurements(db, ts, summary);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    // Las fotos mueven archivos: van fuera de la transacción, de a una (cada fila se inserta
    // recién después de mover su archivo, así un corte a mitad no deja nada inconsistente).
    if (pending.photos && privatePhotosDir) migratePhotos(db, now.toISOString(), summary, { publicPhotosDir, privatePhotosDir });
  }
  ensureColumns(db);
  summary.totals = {
    weighIns: db.prepare("SELECT COUNT(*) AS n FROM weights").get().n,
    plans: db.prepare("SELECT COUNT(*) AS n FROM plans").get().n,
    routines: db.prepare("SELECT COUNT(*) AS n FROM routines").get().n,
    exercises: db.prepare("SELECT COUNT(*) AS n FROM exercises").get().n,
    measurements: db.prepare("SELECT COUNT(*) AS n FROM measurements").get().n,
    photos: db.prepare("SELECT COUNT(*) AS n FROM photos").get().n,
  };
  return summary;
}

/** Resumen legible para la consola. */
export function describeFisicoMigration(s) {
  if (!s.ran) return `Físico v2: nada para migrar (ya estaba al día). Hay ${s.totals.weighIns} pesadas, ${s.totals.plans} planes, ${s.totals.routines} rutinas, ${s.totals.exercises} ejercicios, ${s.totals.measurements} medidas y ${s.totals.photos} fotos.`;
  const parts = [
    `${s.totals.weighIns} pesadas intactas`,
    s.exercisesSeeded && `${s.exercisesSeeded} ejercicios en la biblioteca`,
    s.habitsSeeded && `${s.habitsSeeded} hábitos`,
    s.weightGoal && `meta de peso ${s.weightGoal} kg`,
    s.activePlan && `plan activo "${s.activePlan}"`,
    s.measurements && `${s.measurements} medidas en ${s.measurementSessions} sesiones`,
    s.photos && `${s.photos} fotos movidas a la carpeta privada`,
    s.photosMissing && `${s.photosMissing} fotos sin archivo (no se migraron)`,
    s.routineExercisesKeptAsLegacy && `${s.routineExercisesKeptAsLegacy} ejercicios de rutina viejos guardados como respaldo`,
  ].filter(Boolean);
  return `Físico v2: ${parts.join(" · ")}${s.backupPath ? ` · backup en ${s.backupPath}` : ""}`;
}
