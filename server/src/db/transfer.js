// Mudanza de la base SQLite (la de la PC) a Postgres (Supabase o PGlite), una sola vez.
// - Trabaja sobre una COPIA del archivo: el original no se toca.
// - Antes pone la copia al día con las migraciones viejas de SQLite (así tiene la misma forma que
//   el esquema de Postgres).
// - Copia todas las tablas conservando los ids, ajusta los contadores y verifica tabla por tabla
//   (cantidad de filas y contenido).
// - Las tablas que solo existían como respaldo de migraciones viejas (…_legacy) quedan en el archivo
//   local; se informan.
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sharedSchema } from "./schema/shared.js";
import { fisicoSchema } from "./schema/fisico.js";
import { gastosSchema } from "./schema/gastos.js";
import { ocioSchema } from "./schema/ocio.js";
import { proyectosSchema } from "./schema/proyectos.js";
import { runMigrations } from "./migrate.js";
import { migrateOcioV2 } from "./migrations/ocioV2.js";
import { migrateFisicoV2 } from "./migrations/fisicoV2.js";
import { BASE_SCHEMA } from "./pg/schema.js";

/** Tablas del esquema de Postgres en el orden en que se crean (las referenciadas, antes). */
export const PG_TABLES = [...BASE_SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);

/** Tablas con datos del usuario: si alguna tiene filas en el destino, no se pisa sin --force. */
const USER_DATA = ["weights", "workout_sessions", "expenses", "incomes", "accounts", "works", "outings", "projects", "artworks", "measurements", "photos", "plans"];

/** Copia del archivo SQLite, al día con las migraciones de SQLite. */
export function preparedSqliteCopy(sqlitePath) {
  const dir = mkdtempSync(join(tmpdir(), "gestor-mudanza-"));
  const copyPath = join(dir, "copia.db");
  const src = new DatabaseSync(sqlitePath, { readOnly: true });
  src.exec(`VACUUM INTO '${copyPath.replaceAll("\\", "/").replaceAll("'", "''")}'`);
  src.close();
  const db = new DatabaseSync(copyPath);
  db.exec("PRAGMA foreign_keys = ON");
  for (const s of [sharedSchema, fisicoSchema, gastosSchema, ocioSchema, proyectosSchema]) db.exec(s);
  runMigrations(db);
  migrateOcioV2(db);
  // Sin carpetas de fotos: las fotos viejas ya se movieron en la PC (y la copia no mueve archivos).
  migrateFisicoV2(db);
  return { db, cleanup: () => (db.close(), rmSync(dir, { recursive: true, force: true })) };
}

const sqliteTables = (sdb) => sdb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
const sqliteColumns = (sdb, t) => sdb.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
async function pgColumns(db, t) {
  return (await db.prepare("SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position").all(t)).map((c) => ({ name: c.name, type: c.type }));
}

/** Valor de SQLite → valor para Postgres según el tipo de la columna destino. */
function convert(v, pgType) {
  if (v == null) return null;
  if (pgType === "integer" || pgType === "bigint") {
    if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
    if (typeof v === "number" && !Number.isInteger(v)) return Math.round(v);
    return v;
  }
  if (pgType === "double precision") return typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
  if (pgType === "text") return typeof v === "string" ? v : typeof v === "object" ? Buffer.from(v).toString("utf8") : String(v);
  return v;
}

/** Para comparar origen y destino: números y textos normalizados. */
const norm = (v) => (v == null ? null : typeof v === "number" ? Math.round(v * 1e6) / 1e6 : typeof v === "bigint" ? Number(v) : String(v));

/**
 * @param {{ sqlitePath: string, db: ReturnType<import("./pg.js").createDb>, force?: boolean, log?: (m: string) => void }} opts
 *   db: la base Postgres destino, ya abierta y migrada.
 */
export async function transferSqliteToPg({ sqlitePath, db, force = false, log = () => {} }) {
  // ¿El destino ya tiene datos?
  const present = [];
  for (const t of USER_DATA) {
    const { n } = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get();
    if (n > 0) present.push(`${t} (${n})`);
  }
  if (present.length && !force) {
    const e = new Error(`El destino ya tiene datos: ${present.join(", ")}. Para pisarlos, usá --force.`);
    e.code = "TARGET_NOT_EMPTY";
    throw e;
  }

  const { db: sdb, cleanup } = preparedSqliteCopy(sqlitePath);
  const report = { tables: [], skipped: [], files: null, totalRows: 0 };
  try {
    const inSqlite = new Set(sqliteTables(sdb));
    report.skipped = [...inSqlite].filter((t) => !PG_TABLES.includes(t)).map((t) => ({ table: t, rows: sdb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n }));

    await db.tx(async () => {
      await db.exec(`TRUNCATE ${PG_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
      for (const t of PG_TABLES) {
        if (!inSqlite.has(t)) {
          report.tables.push({ table: t, rows: 0, note: "no existía en SQLite" });
          continue;
        }
        const pgCols = await pgColumns(db, t);
        const sCols = new Map(sqliteColumns(sdb, t).map((c) => [c.toLowerCase(), c]));
        const cols = pgCols.filter((c) => sCols.has(c.name));
        const missing = [...sCols.keys()].filter((c) => !pgCols.some((p) => p.name === c));
        const rows = sdb.prepare(`SELECT ${cols.map((c) => sCols.get(c.name)).join(", ")} FROM ${t}`).all();
        const batch = Math.max(1, Math.floor(30000 / Math.max(1, cols.length)));
        for (let i = 0; i < rows.length; i += batch) {
          const chunk = rows.slice(i, i + batch);
          const values = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
          const params = chunk.flatMap((r) => cols.map((c) => convert(r[sCols.get(c.name)], c.type)));
          await db.prepare(`INSERT INTO ${t} (${cols.map((c) => c.name).join(", ")}) VALUES ${values}`).run(...params);
        }
        report.tables.push({ table: t, rows: rows.length, ...(missing.length ? { droppedColumns: missing } : {}) });
        report.totalRows += rows.length;
        if (rows.length) log(`  ${t}: ${rows.length}`);
      }
      // Los contadores de ids siguen desde el máximo copiado.
      for (const t of PG_TABLES) {
        const hasIdentity = await db.prepare("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = 'id' AND is_identity = 'YES'").get(t);
        if (hasIdentity) await db.prepare(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), (SELECT MAX(id) FROM ${t}) IS NOT NULL)`).get();
      }
    });

    // Verificación: misma cantidad de filas y mismo contenido, tabla por tabla.
    const problems = [];
    for (const t of PG_TABLES) {
      if (!inSqlite.has(t)) continue;
      const pgCols = await pgColumns(db, t);
      const sCols = new Map(sqliteColumns(sdb, t).map((c) => [c.toLowerCase(), c]));
      const cols = pgCols.filter((c) => sCols.has(c.name)).map((c) => c.name);
      const order = cols.includes("id") ? "id" : cols.slice(0, 3).join(", ");
      const a = sdb.prepare(`SELECT ${cols.map((c) => sCols.get(c)).join(", ")} FROM ${t} ORDER BY ${cols.includes("id") ? sCols.get("id") : cols.slice(0, 3).map((c) => sCols.get(c)).join(", ")}`).all();
      const b = await db.prepare(`SELECT ${cols.join(", ")} FROM ${t} ORDER BY ${order}`).all();
      if (a.length !== b.length) {
        problems.push(`${t}: ${a.length} filas en SQLite y ${b.length} en Postgres`);
        continue;
      }
      // Postgres ordena textos distinto que SQLite: se compara como conjunto.
      const key = (r, get) => JSON.stringify(cols.map((c) => norm(get(r, c))));
      const sa = a.map((r) => key(r, (row, c) => row[sCols.get(c)])).sort();
      const sb = b.map((r) => key(r, (row, c) => row[Object.keys(row).find((k) => k.toLowerCase() === c)])).sort();
      const diff = sa.findIndex((v, i) => v !== sb[i]);
      if (diff >= 0) problems.push(`${t}: el contenido no coincide (primera diferencia: ${sa[diff].slice(0, 160)} ≠ ${sb[diff]?.slice(0, 160)})`);
    }
    report.problems = problems;
    return report;
  } finally {
    cleanup();
  }
}
