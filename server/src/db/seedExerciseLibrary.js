import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function seedExerciseLibrary() {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM exercise_library").get();
  if (count > 0) return;

  const path = join(__dirname, "..", "..", "data", "exercise-library.json");
  const exercises = JSON.parse(readFileSync(path, "utf-8"));

  const insert = db.prepare(`
    INSERT INTO exercise_library
      (id, name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const ex of exercises) {
      insert.run(
        ex.id,
        ex.name,
        ex.force ?? null,
        ex.level ?? null,
        ex.mechanic ?? null,
        ex.equipment ?? null,
        JSON.stringify(ex.primaryMuscles ?? []),
        JSON.stringify(ex.secondaryMuscles ?? []),
        JSON.stringify(ex.instructions ?? []),
        ex.category ?? null,
        JSON.stringify(ex.images ?? [])
      );
    }
    db.exec("COMMIT");
    console.log(`[seed] exercise_library: ${exercises.length} ejercicios cargados`);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
