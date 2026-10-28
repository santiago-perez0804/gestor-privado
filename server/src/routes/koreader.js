// Importar estadísticas de KOReader: 1) subir el archivo → vista previa con el vínculo de cada
// libro; 2) confirmar el mapeo → importar. Entre los dos pasos el archivo queda en el almacenamiento
// "imports" (en la nube, cada pedido puede caer en otra instancia: el disco no se comparte).
// Para leerlo con node:sqlite se baja a una copia temporal.
import multer from "multer";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db } from "../db/index.js";
import { createLibrary } from "../services/ocio/library.js";
import { readKoreader, matchBooks, importKoreader, DEFAULT_GAP_MINUTES } from "../services/ocio/koreader.js";
import { koreaderDropbox } from "../services/dropbox/index.js";
import { storage } from "../services/storage/index.js";

// En Vercel los pedidos no pueden pasar de 4,5 MB: los archivos grandes van por Dropbox.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const IMPORT_ID = /^koreader-(\d{10,16})\.sqlite3$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ¿Es una base SQLite? (los primeros 16 bytes son "SQLite format 3\0"). */
const isSqlite = (buf) => buf.length >= 16 && buf.subarray(0, 16).toString("latin1") === "SQLite format 3\u0000";

/** Borra sin quejarse (el archivo puede no existir o estar en uso). */
function removeQuietly(path) {
  try {
    unlinkSync(path);
  } catch {
    // nada
  }
}

/** Escribe el archivo en una copia temporal, lo lee y la borra. */
function readFromBuffer(buf, opts) {
  const tmp = join(tmpdir(), `koreader-read-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite3`);
  writeFileSync(tmp, buf);
  try {
    return readKoreader(tmp, opts);
  } finally {
    removeQuietly(tmp);
  }
}

/** Las vistas previas que nunca se importaron no se acumulan: se borran las de más de un día. */
async function cleanOldImports(imports) {
  const now = Date.now();
  for (const name of await imports.list()) {
    const m = name.match(IMPORT_ID);
    if (m && now - Number(m[1]) > DAY_MS) await imports.remove(name).catch(() => {});
  }
}

/** Libros para la vista previa (sin el detalle de cada sesión). */
const preview = (books) => books.map(({ sessions, ...b }) => ({ ...b, sessionCount: sessions.length }));

export default function registerKoreaderRoutes(app) {
  const lib = createLibrary(db);
  const imports = () => storage("imports");

  app.post("/api/ocio/koreader/preview", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file_required" });
    await cleanOldImports(imports()).catch(() => {});
    const buf = req.file.buffer;
    if (!isSqlite(buf)) return res.status(422).json({ error: "not_sqlite", message: "El archivo no es una base de KOReader (statistics.sqlite3)." });
    const gap = Number(req.body?.gapMinutes) || DEFAULT_GAP_MINUTES;
    let read;
    try {
      read = readFromBuffer(buf, { gapMinutes: gap });
    } catch (err) {
      return res.status(422).json({ error: "unreadable_file", message: `No se pudo leer el archivo (${err.message}).` });
    }
    const { schema, books } = read;
    if (!schema.ok) return res.status(422).json({ error: "unexpected_schema", schema, message: `Al archivo le faltan columnas: ${schema.missing.join(", ")}.` });
    const importId = `koreader-${Date.now()}.sqlite3`;
    await imports().put(importId, buf, { contentType: "application/octet-stream" });
    res.json({ importId, schema, gapMinutes: gap, books: preview(await matchBooks(db, books)) });
  });

  app.post("/api/ocio/koreader/import", async (req, res) => {
    const { importId, mapping, gapMinutes } = req.body || {};
    if (!IMPORT_ID.test(String(importId || ""))) return res.status(404).json({ error: "import_not_found" });
    const buf = await imports().get(importId);
    if (!buf) return res.status(404).json({ error: "import_not_found" });
    const { books } = readFromBuffer(buf, { gapMinutes: Number(gapMinutes) || DEFAULT_GAP_MINUTES });
    res.json(await importKoreader(db, lib, books, mapping || {}));
  });

  app.get("/api/ocio/koreader/status", async (req, res) => {
    const row = await db.prepare("SELECT MAX(lastImportedAt) AS lastImportAt, COUNT(workId) AS linkedBooks FROM koreader_books").get();
    const sessions = (await db.prepare("SELECT COUNT(*) AS n FROM reading_sessions WHERE source = 'koreader'").get()).n;
    const dropbox = await koreaderDropbox().status();
    res.json({ lastImportAt: row.lastImportAt, linkedBooks: row.linkedBooks, sessions, pending: dropbox.pending, dropbox: { connected: dropbox.connected, needsReconnect: dropbox.needsReconnect, lastSyncAt: dropbox.lastSyncAt, lastError: dropbox.lastError } });
  });
}
