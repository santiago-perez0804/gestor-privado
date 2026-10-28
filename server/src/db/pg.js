// Capa de datos sobre Postgres: Supabase en producción (DATABASE_URL) y PGlite (Postgres real en
// WASM, sin instalar nada) en desarrollo y en los tests.
//
// Mantiene la forma de la API de node:sqlite que usaba todo el server, pero asincrónica:
//   await db.prepare(sql).get(...params)   → una fila o undefined
//   await db.prepare(sql).all(...params)   → filas
//   await db.prepare(sql).run(...params)   → { changes, lastInsertRowid }
//   await db.exec(sql)                     → varias sentencias sin parámetros
//   await db.tx(async () => { … })         → transacción (lo que se llame adentro usa la misma conexión)
//
// Cada consulta se traduce una vez (y se cachea) de SQLite a Postgres:
//   - `?` → `$1, $2…` (sin tocar lo que está entre comillas).
//   - `INSERT OR IGNORE` → `INSERT … ON CONFLICT DO NOTHING`; `IFNULL(` → `COALESCE(`.
//   - Los INSERT en tablas con columna `id` devuelven el id (lastInsertRowid), como antes.
//   - Postgres pasa a minúscula los nombres sin comillas (createdAt → createdat): las filas vuelven
//     con los nombres en camelCase usando los identificadores que aparecen en el esquema y en la consulta.
//   - Los booleanos de JS se guardan como 1/0 (las columnas "booleanas" son INTEGER, como en SQLite).
import { AsyncLocalStorage } from "node:async_hooks";

// ---------- traducción ----------

/** minúscula → camelCase de todos los identificadores vistos (esquema + consultas). */
const camel = new Map();
const IDENT = /\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/g;
export function learnIdentifiers(sql) {
  for (const id of String(sql).match(IDENT) || []) {
    const low = id.toLowerCase();
    const prev = camel.get(low);
    if (prev && prev !== id) throw new Error(`Identificadores que solo difieren en mayúsculas: ${prev} / ${id}`);
    camel.set(low, id);
  }
}

/** Tablas con columna `id` (sus INSERT devuelven el id generado). */
const tablesWithId = new Set();
export function learnSchema(schemaSql) {
  learnIdentifiers(schemaSql);
  for (const m of schemaSql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(\s*id\s/gi)) tablesWithId.add(m[1].toLowerCase());
}

/** Reemplaza `?` por `$n` fuera de comillas simples, dobles y comentarios de línea. */
function numberPlaceholders(sql) {
  let out = "";
  let n = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      out += c;
      if (c === quote) quote = sql[i + 1] === quote ? (out += sql[++i], quote) : null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    } else if (c === "?") {
      out += `$${++n}`;
      continue;
    }
    out += c;
  }
  return out;
}

const cache = new Map();
export function translate(sql) {
  let t = cache.get(sql);
  if (t) return t;
  learnIdentifiers(sql);
  let text = numberPlaceholders(sql.trim().replace(/;\s*$/, ""));
  text = text.replace(/\bIFNULL\(/gi, "COALESCE(");
  const insert = text.match(/^\s*INSERT\s+(OR\s+IGNORE\s+)?INTO\s+(\w+)/i);
  if (insert) {
    if (insert[1]) {
      text = text.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
      if (!/\bON\s+CONFLICT\b/i.test(text)) text += " ON CONFLICT DO NOTHING";
    }
    if (tablesWithId.has(insert[2].toLowerCase()) && !/\bRETURNING\b/i.test(text)) text += " RETURNING id";
  }
  t = { text, returnsId: !!insert && /\bRETURNING id$/i.test(text) };
  cache.set(sql, t);
  return t;
}

function remap(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[camel.get(k) ?? k] = v;
  return out;
}

const param = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

// ---------- drivers ----------
// Cada driver expone query(text, params) → { rows, rowCount }, exec(sql), tx(fn(q)) y close().

async function pgliteDriver(dataDir) {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const pg = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  const parsers = { [types.NUMERIC]: Number, [types.INT8]: Number };
  const wrap = (conn) => async (text, params) => {
    const r = await conn.query(text, params, { parsers });
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  return {
    kind: "pglite",
    query: wrap(pg),
    exec: (sql) => pg.exec(sql),
    tx: (fn) => pg.transaction((t) => fn(wrap(t))),
    close: () => pg.close(),
  };
}

async function postgresDriver(url) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // El pooler de Supabase (modo transacción) no admite sentencias preparadas con nombre.
    prepare: false,
    max: Number(process.env.PG_POOL_MAX || 3),
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    types: {
      bigint: { to: 20, from: [20], parse: Number, serialize: String },
      numeric: { to: 1700, from: [1700], parse: Number, serialize: String },
    },
  });
  const wrap = (conn) => async (text, params) => {
    const rows = await conn.unsafe(text, params);
    return { rows, rowCount: rows.count ?? rows.length };
  };
  return {
    kind: "postgres",
    query: wrap(sql),
    exec: (text) => sql.unsafe(text).simple(),
    tx: (fn) => sql.begin((t) => fn(wrap(t))),
    close: () => sql.end({ timeout: 5 }),
  };
}

// ---------- la base ----------

export function createDb() {
  let driver = null;
  const current = new AsyncLocalStorage(); // la conexión de la transacción en curso, si hay

  const query = async (sql, params) => {
    if (!driver) throw new Error("La base todavía no está abierta (falta await db.open())");
    const { text, returnsId } = translate(sql);
    const run = current.getStore() ?? driver.query;
    try {
      const r = await run(text, params.map(param));
      return { ...r, returnsId };
    } catch (err) {
      err.sql = text;
      throw toSqliteLike(err);
    }
  };

  return {
    get driverKind() {
      return driver?.kind ?? null;
    },
    /** Abre la base: `url` postgres://… (Supabase) o, sin url, PGlite en `dataDir` (o en memoria). */
    async open({ url, dataDir } = {}) {
      driver = url ? await postgresDriver(url) : await pgliteDriver(dataDir);
      return this;
    },
    prepare(sql) {
      return {
        get: async (...p) => remap((await query(sql, p)).rows[0]),
        all: async (...p) => (await query(sql, p)).rows.map(remap),
        run: async (...p) => {
          const r = await query(sql, p);
          return { changes: r.rowCount, lastInsertRowid: r.returnsId ? r.rows[0]?.id ?? null : null };
        },
        // Compatibilidad con .iterate(): trae todo y lo recorre.
        async *iterate(...p) {
          for (const row of (await query(sql, p)).rows) yield remap(row);
        },
      };
    },
    async exec(sql) {
      learnIdentifiers(sql);
      const conn = current.getStore();
      if (conn) {
        for (const stmt of splitStatements(sql)) await conn(stmt, []);
        return;
      }
      await driver.exec(sql);
    },
    /** Transacción: si algo falla, no queda nada a medias. Anidada = usa la de afuera. */
    async tx(fn) {
      if (current.getStore()) return fn();
      return driver.tx((conn) => current.run(conn, fn));
    },
    async close() {
      await driver?.close();
      driver = null;
    },
  };
}

/** Divide un script en sentencias (para ejecutarlo dentro de una transacción). */
function splitStatements(sql) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    cur += c;
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === ";") {
      if (cur.trim() !== ";") out.push(cur.trim().slice(0, -1));
      cur = "";
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Los errores de restricciones se parecen a los de SQLite, así el manejo que ya existe sigue andando
 * (el server responde 409/400 en vez de 500): code ERR_SQLITE_ERROR y "constraint failed" en el mensaje.
 */
function toSqliteLike(err) {
  // Un dato con el tipo equivocado (p. ej. /api/x/abc donde va un número): SQLite no encontraba
  // nada; Postgres falla. Es un error del pedido, no del server.
  if (err.code === "22P02" || err.code === "22003" || err.code === "22007") {
    const e = new Error("invalid_input");
    e.status = 400;
    e.cause = err;
    return e;
  }
  const kinds = { 23505: "UNIQUE", 23503: "FOREIGN KEY", 23514: "CHECK", 23502: "NOT NULL" };
  const kind = kinds[err.code];
  if (!kind) return err;
  const e = new Error(`${kind} constraint failed: ${err.detail || err.constraint || err.message}`);
  e.code = "ERR_SQLITE_ERROR";
  e.pgCode = err.code;
  e.cause = err;
  return e;
}
