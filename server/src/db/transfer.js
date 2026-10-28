// Mudanza de datos a una base Postgres (Supabase o PGlite). El origen puede ser:
// - la base SQLite de antes (server/data/fisico.db): se trabaja sobre una COPIA, puesta al día con
//   las migraciones viejas de SQLite (así tiene la misma forma que el esquema de Postgres);
// - otra base Postgres (la PGlite local de la app de escritorio, que tiene lo más nuevo).
// Copia todas las tablas conservando los ids, ajusta los contadores y verifica tabla por tabla
// (cantidad de filas y contenido). Las tablas que solo existían como respaldo de migraciones viejas
// (…_legacy) no se copian; se informan.
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
export const USER_DATA = ["weights", "workout_sessions", "expenses", "incomes", "accounts", "works", "outings", "projects", "artworks", "measurements", "photos", "plans"];

/** ¿La base Postgres tiene datos del usuario? Devuelve la lista ("weights (3)", …). */
export async function userDataIn(db) {
  const present = [];
  for (const t of USER_DATA) {
    const { n } = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get();
    if (n > 0) present.push(`${t} (${n})`);
  }
  return present;
}

// ---------- orígenes ----------
// Cada origen da: tablas, columnas (en minúscula) y filas con esas claves.

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

export function sqliteSource(sqlitePath) {
  const { db: sdb, cleanup } = preparedSqliteCopy(sqlitePath);
  const original = new Map(); // tabla → (minúscula → nombre real)
  const colsOf = (t) => {
    if (!original.has(t)) original.set(t, new Map(sdb.prepare(`PRAGMA table_info(${t})`).all().map((c) => [c.name.toLowerCase(), c.name])));
    return original.get(t);
  };
  return {
    label: "SQLite",
    tables: async () => sdb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name),
    columns: async (t) => [...colsOf(t).keys()],
    count: async (t) => sdb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n,
    rows: async (t, cols) => {
      const real = colsOf(t);
      return sdb
        .prepare(`SELECT ${cols.map((c) => real.get(c)).join(", ")} FROM ${t}`)
        .all()
        .map((r) => Object.fromEntries(cols.map((c) => [c, r[real.get(c)]])));
    },
    close: async () => cleanup(),
  };
}

/** Otra base Postgres (ya abierta) como origen. */
export function pgSource(src) {
  return {
    label: "Postgres",
    tables: async () => (await src.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'").all()).map((r) => r.tablename),
    columns: async (t) => (await pgColumns(src, t)).map((c) => c.name),
    count: async (t) => (await src.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get()).n,
    rows: async (t, cols) => (await src.prepare(`SELECT ${cols.join(", ")} FROM ${t}`).all()).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]))),
    close: async () => {},
  };
}

async function pgColumns(db, t) {
  return (await db.prepare("SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position").all(t)).map((c) => ({ name: c.name, type: c.type }));
}

/** Valor de origen → valor para Postgres según el tipo de la columna destino. */
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
 * Copia todo de `source` a `db` (Postgres destino, ya abierta y migrada) y verifica.
 * @param {{ source: ReturnType<typeof sqliteSource>, db: ReturnType<import("./pg.js").createDb>, force?: boolean, log?: (m: string) => void }} opts
 */
export async function transferToPg({ source, db, force = false, log = () => {} }) {
  const present = await userDataIn(db);
  if (present.length && !force) {
    const e = new Error(`El destino ya tiene datos: ${present.join(", ")}. Para pisarlos, usá --force.`);
    e.code = "TARGET_NOT_EMPTY";
    throw e;
  }
  const report = { tables: [], skipped: [], totalRows: 0, problems: [] };
  const inSource = new Set(await source.tables());
  for (const t of inSource) if (!PG_TABLES.includes(t)) report.skipped.push({ table: t, rows: await source.count(t) });

  // Columnas a copiar por tabla: las que existen en los dos lados.
  const plan = new Map();
  for (const t of PG_TABLES) {
    if (!inSource.has(t)) continue;
    const pgCols = await pgColumns(db, t);
    const srcCols = new Set(await source.columns(t));
    plan.set(t, { cols: pgCols.filter((c) => srcCols.has(c.name)), dropped: [...srcCols].filter((c) => !pgCols.some((p) => p.name === c)) });
  }

  await db.tx(async () => {
    await db.exec(`TRUNCATE ${PG_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
    for (const t of PG_TABLES) {
      if (!plan.has(t)) {
        report.tables.push({ table: t, rows: 0, note: `no existía en ${source.label}` });
        continue;
      }
      const { cols, dropped } = plan.get(t);
      const rows = await source.rows(t, cols.map((c) => c.name));
      const batch = Math.max(1, Math.floor(30000 / Math.max(1, cols.length)));
      for (let i = 0; i < rows.length; i += batch) {
        const chunk = rows.slice(i, i + batch);
        const values = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
        const params = chunk.flatMap((r) => cols.map((c) => convert(r[c.name], c.type)));
        await db.prepare(`INSERT INTO ${t} (${cols.map((c) => c.name).join(", ")}) VALUES ${values}`).run(...params);
      }
      report.tables.push({ table: t, rows: rows.length, ...(dropped.length ? { droppedColumns: dropped } : {}) });
      report.totalRows += rows.length;
      if (rows.length) log(`  ${t}: ${rows.length}`);
    }
    // Los contadores de ids siguen desde el máximo copiado.
    for (const t of PG_TABLES) {
      const hasIdentity = await db.prepare("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = 'id' AND is_identity = 'YES'").get(t);
      if (hasIdentity) await db.prepare(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), (SELECT MAX(id) FROM ${t}) IS NOT NULL)`).get();
    }
  });

  // Verificación: misma cantidad de filas y mismo contenido, tabla por tabla (como conjunto: cada
  // motor ordena los textos a su manera).
  for (const [t, { cols }] of plan) {
    const names = cols.map((c) => c.name);
    const a = await source.rows(t, names);
    const b = (await db.prepare(`SELECT ${names.join(", ")} FROM ${t}`).all()).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
    if (a.length !== b.length) {
      report.problems.push(`${t}: ${a.length} filas en el origen y ${b.length} en el destino`);
      continue;
    }
    const key = (r) => JSON.stringify(names.map((c) => norm(r[c])));
    const sa = a.map(key).sort();
    const sb = b.map(key).sort();
    const diff = sa.findIndex((v, i) => v !== sb[i]);
    if (diff >= 0) report.problems.push(`${t}: el contenido no coincide (primera diferencia: ${sa[diff].slice(0, 160)} ≠ ${sb[diff]?.slice(0, 160)})`);
  }
  return report;
}

/** Atajo: de un archivo SQLite a Postgres. */
export async function transferSqliteToPg({ sqlitePath, db, force = false, log }) {
  const source = sqliteSource(sqlitePath);
  try {
    return await transferToPg({ source, db, force, log });
  } finally {
    await source.close();
  }
}
