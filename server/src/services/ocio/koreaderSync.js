// Sincronización automática de KOReader: el Kindle sube statistics.sqlite3 a Dropbox (plugin de
// estadísticas → "Sincronización en la nube") y acá se baja e importa solo cuando cambió.
// - Libros ya vinculados o con coincidencia exacta → se importan sus sesiones.
// - Libros desconocidos → quedan pendientes (koreader_books con workId NULL) hasta que el usuario
//   elija a qué obra van, si se agregan como nuevos o si se ignoran para siempre.
import { renameSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readKoreader, matchBooks, importKoreader, DEFAULT_GAP_MINUTES } from "./koreader.js";
import { getAccount, saveAccount, DropboxError, MAX_DOWNLOAD_BYTES } from "../dropbox/client.js";

const nowIso = () => new Date().toISOString();
export const SYNCED_FILE = "koreader-dropbox.sqlite3";
export const isSqliteHeader = (buf) => buf?.length >= 16 && buf.toString("latin1", 0, 16) === "SQLite format 3\u0000";

const parse = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

/**
 * @param {{ db: import("node:sqlite").DatabaseSync, lib: ReturnType<import("./library.js").createLibrary>,
 *   files: ReturnType<import("../dropbox/client.js").createDropboxFiles>, importsDir: string, gapMinutes?: number }} deps
 */
export function createKoreaderSync({ db, lib, files, importsDir, gapMinutes = DEFAULT_GAP_MINUTES }) {
  const filePath = () => join(importsDir, SYNCED_FILE);
  const pendingRows = () => db.prepare("SELECT key, title, authors, pages FROM koreader_books WHERE workId IS NULL AND ignored = 0 ORDER BY title").all();
  const pendingCount = () => db.prepare("SELECT COUNT(*) AS n FROM koreader_books WHERE workId IS NULL AND ignored = 0").get().n;

  function readSynced() {
    if (!existsSync(filePath())) throw new DropboxError(409, "Todavía no se bajó ningún archivo de Dropbox.", "no_file");
    const { schema, books } = readKoreader(filePath(), { gapMinutes });
    if (!schema.ok) throw new DropboxError(422, `Al archivo le faltan columnas: ${schema.missing.join(", ")}.`, "unexpected_schema");
    return books;
  }

  /** Importa lo que se puede vincular solo y registra lo demás como pendiente. */
  function importSynced() {
    const matched = matchBooks(db, readSynced());
    const ignored = new Set(db.prepare("SELECT key FROM koreader_books WHERE ignored = 1").all().map((r) => r.key));
    const mapping = {};
    const unknown = [];
    for (const b of matched) {
      if (ignored.has(b.key)) continue;
      if (b.match) mapping[b.key] = String(b.match.workId);
      else unknown.push(b);
    }
    const summary = importKoreader(db, lib, matched.filter((b) => mapping[b.key]), mapping);
    // Los desconocidos quedan a la espera (si ya estaban, solo se actualizan sus datos).
    const markPending = db.prepare(
      `INSERT INTO koreader_books (key, title, authors, pages, workId, lastImportedAt, ignored) VALUES (?, ?, ?, ?, NULL, NULL, 0)
       ON CONFLICT(key) DO UPDATE SET title = excluded.title, authors = excluded.authors, pages = excluded.pages WHERE koreader_books.workId IS NULL`
    );
    for (const b of unknown) markPending.run(b.key, b.title, b.authors, b.pages);
    return { ...summary, pending: pendingCount() };
  }

  /**
   * Revisa Dropbox: si el archivo no cambió (mismo `rev`) no baja nada; si cambió, lo baja, lo
   * valida e importa. `force` vuelve a importar aunque no haya cambiado.
   */
  async function syncNow({ force = false } = {}) {
    const account = getAccount(db);
    if (!account?.refreshTokenEnc) return { changed: false, skipped: "not_connected" };
    const at = nowIso();
    try {
      const meta = await files.getMetadata(account.path);
      if (!meta) {
        saveAccount(db, { lastCheckAt: at, status: "connected", lastError: `Todavía no hay nada en ${account.path}: sincronizá una vez desde el Kindle (Estadísticas → Sincronizar ahora).` });
        return { changed: false, missing: true };
      }
      if (meta.size > MAX_DOWNLOAD_BYTES) throw new DropboxError(413, "El archivo de Dropbox es demasiado grande.");
      if (!force && meta.rev === account.lastRev) {
        saveAccount(db, { lastCheckAt: at, status: "connected", lastError: null });
        return { changed: false };
      }
      const buf = await files.download(account.path);
      if (!isSqliteHeader(buf)) throw new DropboxError(422, "El archivo de Dropbox no es una base de KOReader (statistics.sqlite3).", "not_sqlite");
      // Se escribe aparte y se reemplaza al final: si algo falla, queda el archivo anterior.
      const tmp = `${filePath()}.part`;
      writeFileSync(tmp, buf);
      try {
        readKoreader(tmp, { gapMinutes });
      } catch (err) {
        rmSync(tmp, { force: true });
        throw new DropboxError(422, `No se pudo leer el archivo de Dropbox (${err.message}).`, "unreadable");
      }
      renameSync(tmp, filePath());
      const summary = importSynced();
      saveAccount(db, { lastRev: meta.rev, lastSyncAt: at, lastCheckAt: at, lastError: null, lastSummary: JSON.stringify({ ...summary, at }), status: "connected" });
      return { changed: true, ...summary };
    } catch (err) {
      const revoked = err.code === "invalid_grant" || err.status === 401;
      saveAccount(db, { lastCheckAt: at, status: revoked ? "revoked" : "error", lastError: revoked ? "Dropbox revocó el acceso: hay que reconectar." : err.message });
      throw err;
    }
  }

  /** Libros pendientes con sus datos de lectura y candidatos (para elegir a qué obra van). */
  function pending() {
    const rows = pendingRows();
    if (!rows.length) return { books: [] };
    const keys = new Set(rows.map((r) => r.key));
    let books;
    try {
      books = readSynced().filter((b) => keys.has(b.key));
    } catch {
      books = rows.map((r) => ({ ...r, sessions: [] }));
    }
    return { books: matchBooks(db, books).map(({ sessions, ...b }) => ({ ...b, sessionCount: sessions.length })) };
  }

  /** Resolver pendientes: { [key]: workId | "new" | "ignore" }. */
  function resolve(mapping = {}) {
    const keys = new Set(pendingRows().map((r) => r.key));
    const toImport = {};
    let ignored = 0;
    const ignore = db.prepare("UPDATE koreader_books SET ignored = 1 WHERE key = ?");
    for (const [key, value] of Object.entries(mapping)) {
      if (!keys.has(key)) continue;
      if (value === "ignore") {
        ignore.run(key);
        ignored += 1;
      } else if (value === "new") toImport[key] = "new";
      else if (db.prepare("SELECT 1 FROM works WHERE id = ? AND type = 'book'").get(Number(value))) toImport[key] = String(Number(value));
      else throw new DropboxError(400, "invalid_work", "invalid_work");
    }
    const summary = Object.keys(toImport).length ? importKoreader(db, lib, readSynced().filter((b) => toImport[b.key]), toImport) : { books: 0, created: 0, skipped: 0, sessionsNew: 0, sessionsUpdated: 0 };
    return { ...summary, ignored, pending: pendingCount() };
  }

  function info() {
    const a = getAccount(db);
    return { path: a?.path ?? null, lastSyncAt: a?.lastSyncAt ?? null, lastCheckAt: a?.lastCheckAt ?? null, lastError: a?.lastError ?? null, lastSummary: parse(a?.lastSummary), pending: pendingCount() };
  }

  return { syncNow, pending, resolve, info, pendingCount };
}
