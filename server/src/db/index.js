// La base de datos de toda la app: Postgres.
// - Con DATABASE_URL (Supabase, en Vercel): esa base.
// - Sin DATABASE_URL (desarrollo): PGlite, un Postgres real guardado en <data>/pg.
// La lógica de tablas está en pg/schema.js y pg/migrations.js; la capa de acceso, en pg.js.
//
// `db` se puede importar en cualquier lado (las consultas se preparan sin conectarse); antes de la
// primera consulta hay que haber esperado `openDb()` (lo hacen index.js, la función de Vercel y los tests).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createDb } from "./pg.js";
import { migrate } from "./pg/migrations.js";
import { seedIfEmpty } from "./pg/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const dataDir = process.env.DATA_DIR || join(__dirname, "..", "..", "data");
// Archivos locales (desarrollo, o la app de escritorio sin nube). En la nube van a Supabase Storage.
export const photosDir = join(dataDir, "photos");
export const certificatesDir = join(dataDir, "certificates");
export const coversDir = join(dataDir, "covers");
export const artworksDir = join(dataDir, "artworks");
export const importsDir = join(dataDir, "imports");
// Físico: fotos de progreso privadas (nunca servidas como estáticos; solo por la API).
export const privatePhotosDir = join(dataDir, "private", "photos");

/** En Vercel el disco es de solo lectura (salvo /tmp): las carpetas locales se crean solo fuera de ahí. */
export const localFiles = !process.env.VERCEL;
if (localFiles) {
  for (const dir of [dataDir, photosDir, certificatesDir, coversDir, artworksDir, importsDir, privatePhotosDir]) mkdirSync(dir, { recursive: true });
}

export const db = createDb();

let opening = null;
/** Abre la base una sola vez: conecta, aplica migraciones y siembra si está vacía. */
export function openDb({ url = process.env.DATABASE_URL, pgDir = process.env.PG_DIR || join(dataDir, "pg"), memory = false } = {}) {
  opening ??= (async () => {
    await db.open(url ? { url } : { dataDir: memory ? undefined : pgDir });
    const applied = await migrate(db);
    if (applied.length) console.log(`[db] migraciones aplicadas: ${applied.join(", ")}`);
    const { seeded } = await seedIfEmpty(db);
    if (seeded) console.log("[db] base nueva: biblioteca de ejercicios y hábitos de ejemplo cargados");
    return db;
  })().catch((err) => {
    opening = null;
    throw err;
  });
  return opening;
}

export function nowIso() {
  return new Date().toISOString();
}
