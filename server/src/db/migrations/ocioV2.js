// Migración del módulo Ocio al modelo nuevo (rediseño 2026). Idempotente: se puede correr las veces
// que haga falta; cada obra recuerda de qué registro viejo vino (legacyMediaItemId) y la tabla de
// salidas se reconstruye una sola vez. Antes de tocar nada hace un backup de la base.
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  LEGACY_TYPE,
  LEGACY_STATUS,
  legacyProgressUnit,
  guessOutingCategory,
  legacyOutingStatus,
} from "../../lib/ocio/constants.js";

const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const tableExists = (db, name) => !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

function pendingWork(db) {
  const media = tableExists(db, "media_items")
    ? db.prepare("SELECT COUNT(*) AS n FROM media_items WHERE id NOT IN (SELECT legacyMediaItemId FROM library_entries WHERE legacyMediaItemId IS NOT NULL)").get().n
    : 0;
  const outingsOld = columns(db, "outings").includes("plannedDate");
  return { media, outingsOld };
}

/** Copia consistente de la base aunque esté abierta (VACUUM INTO). */
function backup(db, backupsDir, now = new Date()) {
  if (!backupsDir) return null;
  mkdirSync(backupsDir, { recursive: true });
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const path = join(backupsDir, `fisico-${stamp}-antes-ocio-v2.db`);
  if (!existsSync(path)) db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  return path;
}

function migrateMedia(db, ts, summary) {
  const rows = db
    .prepare("SELECT * FROM media_items WHERE id NOT IN (SELECT legacyMediaItemId FROM library_entries WHERE legacyMediaItemId IS NOT NULL) ORDER BY id")
    .all();
  const insertWork = db.prepare(
    "INSERT INTO works (type, title, creators, genres, metadata, createdAt, updatedAt) VALUES (?, ?, '[]', '[]', ?, ?, ?)"
  );
  const insertEntry = db.prepare(
    "INSERT INTO library_entries (workId, status, rating, notes, legacyMediaItemId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertPass = db.prepare(
    "INSERT INTO passes (entryId, number, status, startedAt, finishedAt, progress, createdAt, updatedAt) VALUES (?, 1, ?, ?, ?, ?, ?, ?)"
  );
  for (const m of rows) {
    const type = LEGACY_TYPE[m.type];
    const status = LEGACY_STATUS[m.status];
    const metadata = m.icon ? { legacyIcon: m.icon } : {};
    const created = m.createdAt || ts;
    const workId = insertWork.run(type, m.title, JSON.stringify(metadata), created, m.updatedAt || ts).lastInsertRowid;
    const entryId = insertEntry.run(workId, status, m.rating ?? null, m.notes ?? null, m.id, created, m.updatedAt || ts).lastInsertRowid;
    summary.works += 1;
    summary.byType[type] = (summary.byType[type] || 0) + 1;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    // Lo que ya empezaste (o terminaste o dejaste) tiene una primera "pasada" con su progreso.
    if (status !== "want") {
      const progress = {};
      if (m.progressCurrent != null || m.progressTotal != null) {
        progress.unit = legacyProgressUnit(m.progressLabel, type);
        if (m.progressCurrent != null) progress.current = m.progressCurrent;
        if (m.progressTotal != null) progress.total = m.progressTotal;
      }
      insertPass.run(entryId, status, m.startedAt ?? null, m.finishedAt ?? null, JSON.stringify(progress), created, m.updatedAt || ts);
      summary.passes += 1;
    }
  }
}

function rebuildOutings(db, summary) {
  db.exec("ALTER TABLE outings RENAME TO outings_legacy");
  // Los índices viejos viajan con la tabla renombrada: se borran para reusar los nombres.
  db.exec("DROP INDEX IF EXISTS idx_outings_plannedDate; DROP INDEX IF EXISTS idx_outings_status;");
  db.exec(`CREATE TABLE outings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT,
    date TEXT NOT NULL,
    startTime TEXT,
    endTime TEXT,
    allDay INTEGER NOT NULL DEFAULT 1,
    place TEXT,
    withWhom TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'tentative' CHECK(status IN ('tentative','confirmed','attended','not_attended')),
    icon TEXT,
    source TEXT NOT NULL DEFAULT 'app' CHECK(source IN ('app','google')),
    googleEventId TEXT UNIQUE,
    googleEtag TEXT,
    googleUpdated TEXT,
    deletedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`);
  const insert = db.prepare(
    `INSERT INTO outings (id, title, category, date, allDay, place, notes, status, icon, source, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'app', ?, ?)`
  );
  for (const o of db.prepare("SELECT * FROM outings_legacy ORDER BY id").all()) {
    const status = legacyOutingStatus(o);
    const notes = o.status === "cancelado" ? [o.notes, "Cancelada"].filter(Boolean).join(" · ") : o.notes;
    insert.run(o.id, o.title, guessOutingCategory(o), o.plannedDate, o.location, notes, status, o.icon, o.createdAt, o.updatedAt);
    summary.outings += 1;
    summary.outingsByStatus[status] = (summary.outingsByStatus[status] || 0) + 1;
  }
}

/** Índices y tablas que dependen de la forma nueva de `outings` (siempre, es idempotente). */
function ensureOutingExtras(db) {
  // Cuándo se sincronizó por última vez con Google (para saber si hay cambios locales sin subir).
  if (!columns(db, "outings").includes("googleSyncedAt")) db.exec("ALTER TABLE outings ADD COLUMN googleSyncedAt TEXT");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_outings_date ON outings(date);
    CREATE INDEX IF NOT EXISTS idx_outings_status ON outings(status);
    CREATE TABLE IF NOT EXISTS outing_expenses (
      outingId INTEGER NOT NULL REFERENCES outings(id) ON DELETE CASCADE,
      expenseId INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      PRIMARY KEY (outingId, expenseId)
    );
    CREATE INDEX IF NOT EXISTS idx_outing_expenses_expense ON outing_expenses(expenseId);
  `);
}

/**
 * Sincronización automática de KOReader por Dropbox (siempre, es idempotente):
 * - `koreader_books.ignored`: libros del Kindle que el usuario marcó "no importar nunca".
 *   Un libro con `workId` NULL y sin ignorar es un pendiente de confirmar.
 * - `dropbox_account`: la cuenta conectada (refresh token cifrado) y el estado de la sincronización.
 */
function ensureKoreaderSync(db) {
  if (!columns(db, "koreader_books").includes("ignored")) db.exec("ALTER TABLE koreader_books ADD COLUMN ignored INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    CREATE TABLE IF NOT EXISTS dropbox_account (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      refreshTokenEnc TEXT,
      email TEXT,
      path TEXT NOT NULL DEFAULT '/statistics.sqlite3',
      lastRev TEXT,
      lastSyncAt TEXT,
      lastCheckAt TEXT,
      lastError TEXT,
      lastSummary TEXT,
      status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('disconnected','connected','revoked','error')),
      updatedAt TEXT NOT NULL
    );
  `);
}

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ backupsDir?: string, now?: Date }} [options]
 * @returns {{ ran: boolean, backupPath: string|null, works: number, passes: number, outings: number,
 *   byType: Record<string, number>, byStatus: Record<string, number>, outingsByStatus: Record<string, number> }}
 */
export function migrateOcioV2(db, { backupsDir, now = new Date() } = {}) {
  const summary = { ran: false, backupPath: null, works: 0, passes: 0, outings: 0, byType: {}, byStatus: {}, outingsByStatus: {} };
  const pending = pendingWork(db);
  if (pending.media > 0 || pending.outingsOld) {
    summary.ran = true;
    summary.backupPath = backup(db, backupsDir, now);
    const ts = now.toISOString();
    db.exec("BEGIN");
    try {
      if (pending.media > 0) migrateMedia(db, ts, summary);
      if (pending.outingsOld) rebuildOutings(db, summary);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  ensureOutingExtras(db);
  ensureKoreaderSync(db);
  return summary;
}

/** Resumen legible para la consola. */
export function describeMigration(s) {
  if (!s.ran) return "Ocio v2: nada para migrar (ya estaba al día).";
  const parts = [`Ocio v2: migradas ${s.works} obras (${Object.entries(s.byType).map(([k, v]) => `${v} ${k}`).join(", ") || "ninguna"})`];
  if (s.works) parts.push(`estados: ${Object.entries(s.byStatus).map(([k, v]) => `${k} ${v}`).join(", ")}; ${s.passes} pasadas`);
  if (s.outings) parts.push(`${s.outings} salidas (${Object.entries(s.outingsByStatus).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  if (s.backupPath) parts.push(`backup en ${s.backupPath}`);
  return parts.join(" · ");
}
