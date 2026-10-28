// Base Postgres para los tests: PGlite en memoria (Postgres real, sin instalar nada). Una por
// archivo de test (abrirla tarda ~2 s) y se vacía entre tests, así cada uno arranca limpio.
import { createDb } from "../../src/db/pg.js";
import { migrate } from "../../src/db/pg/migrations.js";
import { seedIfEmpty } from "../../src/db/pg/seed.js";

let shared = null;
let tables = null;

/**
 * Base limpia, con las migraciones aplicadas.
 * @param {{ seed?: boolean }} [opts] seed: cargar la biblioteca de ejercicios y los hábitos (como una instalación nueva).
 */
export async function testDb({ seed = true } = {}) {
  if (!shared) {
    shared = createDb();
    await shared.open();
    await migrate(shared);
    tables = (await shared.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'").all()).map((r) => r.tablename);
  }
  await shared.exec(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  if (seed) await seedIfEmpty(shared);
  return shared;
}
