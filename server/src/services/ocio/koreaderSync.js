// Sincronización automática de KOReader: el Kindle sube statistics.sqlite3 a Dropbox (plugin de
// estadísticas → "Sincronización en la nube") y acá se baja e importa solo cuando cambió.
// - Libros ya vinculados o con coincidencia exacta → se importan sus sesiones.
// - Libros desconocidos → quedan pendientes (koreader_books con workId NULL) hasta que el usuario
//   elija a qué obra van, si se agregan como nuevos o si se ignoran para siempre.
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { storage, localStore } from "../storage/index.js";
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
 *   files: ReturnType<import("../dropbox/client.js").createDropboxFiles>, importsDir?: string, gapMinutes?: number }} deps
 *   importsDir: carpeta local (tests); por defecto el almacenamiento "imports" (Supabase o local).
 */
export function createKoreaderSync({ db, lib, files, importsDir, gapMinutes = DEFAULT_GAP_MINUTES }) {
  const store = importsDir ? localStore(importsDir) : storage("imports");
  const pendingRows = async () => await db.prepare("SELECT key, title, authors, pages FROM koreader_books WHERE workId IS NULL AND ignored = 0 ORDER BY title").all();
  const pendingCount = async () => (await db.prepare("SELECT COUNT(*) AS n FROM koreader_books WHERE workId IS NULL AND ignored = 0").get()).n;

  async function readSynced() {
    const path = await store.localFile(SYNCED_FILE);
    if (!path) throw new DropboxError(409, "Todavía no se bajó ningún archivo de Dropbox.", "no_file");
    const { schema, books } = readKoreader(path, { gapMinutes });
    if (!schema.ok) throw new DropboxError(422, `Al archivo le faltan columnas: ${schema.missing.join(", ")}.`, "unexpected_schema");
    return books;
  }

  /** Importa lo que se puede vincular solo y registra lo demás como pendiente. */
  async function importSynced() {
    const matched = await matchBooks(db, await readSynced());
    const ignored = new Set((await db.prepare("SELECT key FROM koreader_books WHERE ignored = 1").all()).map((r) => r.key));
    const mapping = {};
    const unknown = [];
    for (const b of matched) {
      if (ignored.has(b.key)) continue;
      if (b.match) mapping[b.key] = String(b.match.workId);
      else unknown.push(b);
    }
    const summary = await importKoreader(db, lib, matched.filter((b) => mapping[b.key]), mapping);
    // Los desconocidos quedan a la espera (si ya estaban, solo se actualizan sus datos).
    const markPending = db.prepare(
      `INSERT INTO koreader_books (key, title, authors, pages, workId, lastImportedAt, ignored) VALUES (?, ?, ?, ?, NULL, NULL, 0)
       ON CONFLICT(key) DO UPDATE SET title = excluded.title, authors = excluded.authors, pages = excluded.pages WHERE koreader_books.workId IS NULL`
    );
    for (const b of unknown) await markPending.run(b.key, b.title, b.authors, b.pages);
    return { ...summary, pending: await pendingCount() };
  }

  /**
   * Revisa Dropbox: si el archivo no cambió (mismo `rev`) no baja nada; si cambió, lo baja, lo
   * valida e importa. `force` vuelve a importar aunque no haya cambiado.
   */
  async function syncNow({ force = false } = {}) {
    const account = await getAccount(db);
    if (!account?.refreshTokenEnc) return { changed: false, skipped: "not_connected" };
    const at = nowIso();
    try {
      const meta = await files.getMetadata(account.path);
      if (!meta) {
        await saveAccount(db, { lastCheckAt: at, status: "connected", lastError: `Todavía no hay nada en ${account.path}: sincronizá una vez desde el Kindle (Estadísticas → Sincronizar ahora).` });
        return { changed: false, missing: true };
      }
      if (meta.size > MAX_DOWNLOAD_BYTES) throw new DropboxError(413, "El archivo de Dropbox es demasiado grande.");
      if (!force && meta.rev === account.lastRev) {
        await saveAccount(db, { lastCheckAt: at, status: "connected", lastError: null });
        return { changed: false };
      }
      const buf = await files.download(account.path);
      if (!isSqliteHeader(buf)) throw new DropboxError(422, "El archivo de Dropbox no es una base de KOReader (statistics.sqlite3).", "not_sqlite");
      // Se valida en una copia temporal y recién después reemplaza al anterior: si algo falla, queda el viejo.
      const tmp = join(tmpdir(), `koreader-check-${process.pid}-${Date.now()}.sqlite3`);
      writeFileSync(tmp, buf);
      try {
        readKoreader(tmp, { gapMinutes });
      } catch (err) {
        throw new DropboxError(422, `No se pudo leer el archivo de Dropbox (${err.message}).`, "unreadable");
      } finally {
        rmSync(tmp, { force: true });
      }
      await store.put(SYNCED_FILE, buf, { contentType: "application/octet-stream" });
      const summary = await importSynced();
      await saveAccount(db, { lastRev: meta.rev, lastSyncAt: at, lastCheckAt: at, lastError: null, lastSummary: JSON.stringify({ ...summary, at }), status: "connected" });
      return { changed: true, ...summary };
    } catch (err) {
      const revoked = err.code === "invalid_grant" || err.status === 401;
      await saveAccount(db, { lastCheckAt: at, status: revoked ? "revoked" : "error", lastError: revoked ? "Dropbox revocó el acceso: hay que reconectar." : err.message });
      throw err;
    }
  }

  /** Libros pendientes con sus datos de lectura y candidatos (para elegir a qué obra van). */
  async function pending() {
    const rows = await pendingRows();
    if (!rows.length) return { books: [] };
    const keys = new Set(rows.map((r) => r.key));
    let books;
    try {
      books = (await readSynced()).filter((b) => keys.has(b.key));
    } catch {
      books = rows.map((r) => ({ ...r, sessions: [] }));
    }
    return { books: (await matchBooks(db, books)).map(({ sessions, ...b }) => ({ ...b, sessionCount: sessions.length })) };
  }

  /** Resolver pendientes: { [key]: workId | "new" | "ignore" }. */
  async function resolve(mapping = {}) {
    const keys = new Set((await pendingRows()).map((r) => r.key));
    const toImport = {};
    let ignored = 0;
    const ignore = db.prepare("UPDATE koreader_books SET ignored = 1 WHERE key = ?");
    for (const [key, value] of Object.entries(mapping)) {
      if (!keys.has(key)) continue;
      if (value === "ignore") {
        await ignore.run(key);
        ignored += 1;
      } else if (value === "new") toImport[key] = "new";
      else if (await db.prepare("SELECT 1 FROM works WHERE id = ? AND type = 'book'").get(Number(value))) toImport[key] = String(Number(value));
      else throw new DropboxError(400, "invalid_work", "invalid_work");
    }
    const summary = Object.keys(toImport).length ? await importKoreader(db, lib, (await readSynced()).filter((b) => toImport[b.key]), toImport) : { books: 0, created: 0, skipped: 0, sessionsNew: 0, sessionsUpdated: 0 };
    return { ...summary, ignored, pending: await pendingCount() };
  }

  async function info() {
    const a = await getAccount(db);
    return { path: a?.path ?? null, lastSyncAt: a?.lastSyncAt ?? null, lastCheckAt: a?.lastCheckAt ?? null, lastError: a?.lastError ?? null, lastSummary: parse(a?.lastSummary), pending: await pendingCount() };
  }

  return { syncNow, pending, resolve, info, pendingCount };
}
