import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Carga la biblioteca grande (en inglés) si la tabla está vacía y el JSON está disponible. */
export async function seedExerciseLibrary() {
  const { count } = await db.prepare("SELECT COUNT(*) as count FROM exercise_library").get();
  if (count > 0) return;

  const path = join(__dirname, "..", "..", "data", "exercise-library.json");
  if (!existsSync(path)) return;
  const exercises = JSON.parse(readFileSync(path, "utf-8"));

  const insert = db.prepare(`
    INSERT INTO exercise_library
      (id, name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING
  `);

  await db.tx(async () => {
    for (const ex of exercises) {
      await insert.run(
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
  });
  console.log(`[seed] exercise_library: ${exercises.length} ejercicios cargados`);
}
