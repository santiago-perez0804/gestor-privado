// Importar estadísticas de KOReader: 1) subir el archivo → vista previa con el vínculo de cada
// libro; 2) confirmar el mapeo → importar. El archivo queda en data/imports.
import multer from "multer";
import { openSync, readSync, closeSync, renameSync, existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { db, importsDir } from "../db/index.js";
import { createLibrary } from "../services/ocio/library.js";
import { readKoreader, matchBooks, importKoreader, DEFAULT_GAP_MINUTES } from "../services/ocio/koreader.js";
import { koreaderDropbox } from "../services/dropbox/index.js";

const upload = multer({ dest: importsDir, limits: { fileSize: 100 * 1024 * 1024 } });

/** ¿Es una base SQLite? (los primeros 16 bytes son "SQLite format 3\0"). */
function isSqlite(path) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(16);
    readSync(fd, buf, 0, 16, 0);
    return buf.toString("latin1") === "SQLite format 3\u0000";
  } finally {
    closeSync(fd);
  }
}

/** Borra sin quejarse (el archivo puede no existir o estar en uso). */
function removeQuietly(path) {
  try {
    unlinkSync(path);
  } catch {
    // nada
  }
}

/** Las vistas previas que nunca se importaron no se acumulan: se borran las de más de un día. */
function cleanOldImports(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  for (const f of readdirSync(importsDir)) {
    const p = join(importsDir, f);
    try {
      if (now - statSync(p).mtimeMs > maxAgeMs) removeQuietly(p);
    } catch {
      // nada
    }
  }
}

/** Libros para la vista previa (sin el detalle de cada sesión). */
const preview = (books) =>
  books.map(({ sessions, ...b }) => ({ ...b, sessionCount: sessions.length }));

export default function registerKoreaderRoutes(app) {
  const lib = createLibrary(db);

  app.post("/api/ocio/koreader/preview", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file_required" });
    cleanOldImports();
    if (!isSqlite(req.file.path)) {
      removeQuietly(req.file.path);
      return res.status(422).json({ error: "not_sqlite", message: "El archivo no es una base de KOReader (statistics.sqlite3)." });
    }
    const importId = `koreader-${Date.now()}.sqlite3`;
    renameSync(req.file.path, join(importsDir, importId));
    const gap = Number(req.body?.gapMinutes) || DEFAULT_GAP_MINUTES;
    let read;
    try {
      read = readKoreader(join(importsDir, importId), { gapMinutes: gap });
    } catch (err) {
      removeQuietly(join(importsDir, importId));
      return res.status(422).json({ error: "unreadable_file", message: `No se pudo leer el archivo (${err.message}).` });
    }
    const { schema, books } = read;
    if (!schema.ok) {
      removeQuietly(join(importsDir, importId));
      return res.status(422).json({ error: "unexpected_schema", schema, message: `Al archivo le faltan columnas: ${schema.missing.join(", ")}.` });
    }
    res.json({ importId, schema, gapMinutes: gap, books: preview(matchBooks(db, books)) });
  });

  app.post("/api/ocio/koreader/import", (req, res, next) => {
    try {
      const { importId, mapping, gapMinutes } = req.body || {};
      const path = join(importsDir, basename(String(importId || "")));
      if (!importId || !existsSync(path)) return res.status(404).json({ error: "import_not_found" });
      const { books } = readKoreader(path, { gapMinutes: Number(gapMinutes) || DEFAULT_GAP_MINUTES });
      res.json(importKoreader(db, lib, books, mapping || {}));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/ocio/koreader/status", (req, res) => {
    const row = db.prepare("SELECT MAX(lastImportedAt) AS lastImportAt, COUNT(workId) AS linkedBooks FROM koreader_books").get();
    const sessions = db.prepare("SELECT COUNT(*) AS n FROM reading_sessions WHERE source = 'koreader'").get().n;
    const dropbox = koreaderDropbox().status();
    res.json({ lastImportAt: row.lastImportAt, linkedBooks: row.linkedBooks, sessions, pending: dropbox.pending, dropbox: { connected: dropbox.connected, needsReconnect: dropbox.needsReconnect, lastSyncAt: dropbox.lastSyncAt, lastError: dropbox.lastError } });
  });
}
