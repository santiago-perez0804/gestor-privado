// Datos de arranque de una base nueva (desarrollo, tests, o una instalación desde cero): la
// biblioteca de ejercicios en español (fuerza y cardio) y los hábitos de ejemplo. La base real no
// pasa por acá: llega entera con la mudanza (scripts/migrateToSupabase.mjs).
import { FISICO_EXERCISES, FISICO_CARDIO } from "../seeds/fisicoExercises.js";

export const FISICO_SCHEMA_VERSION = 3;

const HABITS = [
  ["Proteína", "160 g por día"],
  ["Creatina", "5 g"],
  ["Agua", "3 litros"],
  ["Caminata", "8.000 pasos"],
  ["Dormir antes de las 0", "para levantarte 7 h después"],
];

const CARDIO_FLAG = "fisico.cardioSeeded";

async function insertCardio(db, ts) {
  const cardio = db.prepare(
    `INSERT INTO exercises (name, equipment, bar, isBodyweight, muscles, notes, isCustom, kind, cardioFields, levelLabel, countLabel, createdAt, updatedAt)
     VALUES (?, ?, NULL, 0, '[]', ?, 0, 'cardio', ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`
  );
  for (const c of FISICO_CARDIO) await cardio.run(c.name, c.equipment, c.notes, JSON.stringify(c.fields), c.levelLabel, c.countLabel, ts, ts);
  await db.prepare("INSERT INTO settings (key, value) VALUES (?, '1') ON CONFLICT(key) DO NOTHING").run(CARDIO_FLAG);
}

/**
 * Ejercicios de cardio una sola vez (también en bases que vinieron de la PC, donde una versión
 * intermedia marcó la versión sin cargarlos). Si después borrás uno, no vuelve.
 */
export async function ensureCardio(db, { now = new Date() } = {}) {
  if (await db.prepare("SELECT 1 FROM settings WHERE key = ?").get(CARDIO_FLAG)) return false;
  await db.tx(() => insertCardio(db, now.toISOString()));
  return true;
}

/** Siembra solo si la base está vacía de Físico (no hay versión ni ejercicios). */
export async function seedIfEmpty(db, { now = new Date() } = {}) {
  const version = await db.prepare("SELECT value FROM settings WHERE key = 'fisico.schemaVersion'").get();
  const { n } = await db.prepare("SELECT COUNT(*) AS n FROM exercises").get();
  if (version || n > 0) return { seeded: false };
  const ts = now.toISOString();
  await db.tx(async () => {
    const strength = db.prepare(
      `INSERT INTO exercises (name, equipment, bar, isBodyweight, muscles, notes, isCustom, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT DO NOTHING`
    );
    for (const e of FISICO_EXERCISES) await strength.run(e.name, e.equipment, e.bar, e.isBodyweight ? 1 : 0, JSON.stringify(e.muscles), e.notes, ts, ts);
    await insertCardio(db, ts);
    const habit = db.prepare("INSERT INTO habits (name, targetLabel, sortOrder, archived, createdAt) VALUES (?, ?, ?, 0, ?)");
    for (const [i, [name, target]] of HABITS.entries()) await habit.run(name, target, i, ts);
    await db.prepare("INSERT INTO settings (key, value) VALUES ('fisico.schemaVersion', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(FISICO_SCHEMA_VERSION));
  });
  return { seeded: true };
}
