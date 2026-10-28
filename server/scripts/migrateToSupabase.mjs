// Mudanza a la nube (una vez): la base de la PC → Supabase (Postgres) y los archivos → Supabase Storage.
//
//   node scripts/migrateToSupabase.mjs                 → usa DATABASE_URL, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del .env
//   node scripts/migrateToSupabase.mjs --dry-run       → prueba completa contra una base local temporal (no toca Supabase)
//   node scripts/migrateToSupabase.mjs --pglite <dir>  → a una base PGlite local (para probar)
//   --from <archivo.db>   base de origen (por defecto data/fisico.db; no se modifica)
//   --files <carpeta>     carpeta de datos con las fotos, portadas, etc. (por defecto data/)
//   --force               pisar el destino aunque ya tenga datos
//   --skip-files          solo la base
//
// Antes: cerrá la app de escritorio, así nadie escribe en la base mientras se copia.
import "../src/env.js";
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db/pg.js";
import { migrate } from "../src/db/pg/migrations.js";
import { transferSqliteToPg } from "../src/db/transfer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

const dataDir = resolve(opt("--files", join(__dirname, "..", "data")));
const from = resolve(opt("--from", join(dataDir, "fisico.db")));
const dry = flag("--dry-run");
const pgliteDir = opt("--pglite", dry ? mkdtempSync(join(tmpdir(), "gestor-dry-")) : null);

if (!existsSync(from)) {
  console.error(`No encuentro la base de origen: ${from}`);
  process.exit(1);
}
if (!pgliteDir && !process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (la conexión a Supabase) en el .env. Para probar sin tocar Supabase: --dry-run");
  process.exit(1);
}

const db = createDb();
await db.open(pgliteDir ? { dataDir: pgliteDir } : { url: process.env.DATABASE_URL });
console.log(`Destino: ${pgliteDir ? `PGlite en ${pgliteDir}` : "Supabase (DATABASE_URL)"}`);
const applied = await migrate(db);
if (applied.length) console.log(`Esquema creado: ${applied.join(", ")}`);

console.log(`\nCopiando ${from} …`);
let report;
try {
  report = await transferSqliteToPg({ sqlitePath: from, db, force: flag("--force"), log: (m) => console.log(m) });
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  await db.close();
  process.exit(1);
}

console.log(`\n${report.totalRows} filas copiadas en ${report.tables.filter((t) => t.rows).length} tablas.`);
for (const t of report.tables.filter((x) => x.droppedColumns)) console.log(`  (columnas viejas que no se usan más en ${t.table}: ${t.droppedColumns.join(", ")})`);
if (report.skipped.length) console.log(`Quedan solo en el archivo local (respaldos de migraciones viejas): ${report.skipped.map((s) => `${s.table} (${s.rows})`).join(", ")}`);
if (report.problems.length) {
  console.error(`\n✖ La verificación encontró diferencias:\n  ${report.problems.join("\n  ")}`);
  await db.close();
  process.exit(1);
}
console.log("✔ Verificación: misma cantidad de filas y mismo contenido en todas las tablas.");

// ---------- archivos ----------
if (!flag("--skip-files")) {
  const { storage, ensureBuckets, cloudStorage } = await import("../src/services/storage/index.js");
  if (!pgliteDir && !cloudStorage()) {
    console.error("\nFaltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para subir los archivos (la base ya quedó copiada). Volvé a correr con --skip-files cuando estén, o agregalas y corré de nuevo con --force.");
  } else if (pgliteDir) {
    console.log("\n(Prueba local: los archivos no se suben.)");
  } else {
    await ensureBuckets();
    const plan = [
      ["photos", join(dataDir, "private", "photos")],
      ["covers", join(dataDir, "covers")],
      ["artworks", join(dataDir, "artworks")],
      ["certificates", join(dataDir, "certificates")],
      ["imports", join(dataDir, "imports")],
    ];
    for (const [bucket, dir] of plan) {
      if (!existsSync(dir)) continue;
      const store = storage(bucket);
      const already = new Set(await store.list());
      const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
      let up = 0;
      for (const f of files) {
        if (already.has(f) && !flag("--force")) continue;
        await store.put(f, readFileSync(join(dir, f)));
        up++;
      }
      console.log(`  ${bucket}: ${up} subidos${files.length - up ? `, ${files.length - up} ya estaban` : ""}`);
    }
    console.log("✔ Archivos en Supabase Storage (buckets privados).");
  }
}

await db.close();
if (dry) rmSync(pgliteDir, { recursive: true, force: true });
console.log(dry ? "\nPrueba terminada: todo en orden. Para la mudanza real, corré el mismo comando sin --dry-run." : "\nListo.");
