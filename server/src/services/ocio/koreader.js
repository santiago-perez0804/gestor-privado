// Importador de estadísticas de KOReader (plugin "Estadísticas de lectura": statistics.sqlite3).
//
// No asume el esquema: lo inspecciona y exige solo lo que usa. Lo que se espera (KOReader ≥ 2020):
//   book(id, title, authors?, md5?, pages?)
//   page_stat_data(id_book, page, start_time [unix s], duration [s], total_pages?)
// Cada fila de page_stat_data es "estuve N segundos en la página P". Se agrupan en sesiones: filas
// seguidas con menos de `gapMinutes` de pausa son la misma sesión.
//
// Idempotente: cada sesión se identifica por libro + hora de inicio (externalKey) y se actualiza si
// el archivo trae más datos de esa misma sesión, así subir el mismo archivo dos veces no duplica.
import { DatabaseSync } from "node:sqlite";

export const DEFAULT_GAP_MINUTES = 10;

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const lastNames = (authors) =>
  new Set(
    String(authors || "")
      .split(/[\n,;&]| y | and /)
      .map((a) => norm(a).split(" ").at(-1))
      .filter(Boolean)
  );
/** Fecha local (zona del equipo) de un instante ISO. */
const localDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const parseList = (t) => {
  try {
    return JSON.parse(t || "[]");
  } catch {
    return [];
  }
};

/** Qué tablas y columnas tiene el archivo, y si alcanza para importar. */
export function inspectSchema(kdb) {
  const tables = kdb.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all().map((t) => t.name);
  const cols = (t) => (tables.includes(t) ? kdb.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name) : []);
  const book = cols("book");
  const pageStat = cols("page_stat_data");
  const missing = [
    ...["id", "title"].filter((c) => !book.includes(c)).map((c) => `book.${c}`),
    ...["id_book", "page", "start_time", "duration"].filter((c) => !pageStat.includes(c)).map((c) => `page_stat_data.${c}`),
  ];
  return { tables, columns: { book, page_stat_data: pageStat }, ok: missing.length === 0, missing };
}

/** Clave estable de un libro de KOReader: md5 del archivo, o título|autores. */
export const bookKey = (b) => (b.md5 ? `md5:${b.md5}` : `t:${norm(b.title)}|${norm(b.authors)}`);

/**
 * Filas de página → sesiones. Una pausa de más de `gapMinutes` entre el fin de una lectura y el
 * comienzo de la siguiente corta la sesión.
 * @param {{ page: number, start_time: number, duration: number }[]} rows ordenadas por start_time
 * @returns {{ start: number, durationSeconds: number, pagesRead: number, lastPage: number }[]}
 */
export function toSessions(rows, gapMinutes = DEFAULT_GAP_MINUTES) {
  const sessions = [];
  let current = null;
  let lastEnd = 0;
  for (const r of rows) {
    if (!r.duration || r.duration < 0) continue;
    if (!current || r.start_time - lastEnd > gapMinutes * 60) {
      current = { start: r.start_time, durationSeconds: 0, pages: new Set(), lastPage: r.page };
      sessions.push(current);
    }
    current.durationSeconds += r.duration;
    current.pages.add(r.page);
    current.lastPage = r.page;
    lastEnd = Math.max(lastEnd, r.start_time + r.duration);
  }
  return sessions.map((s) => ({ start: s.start, durationSeconds: s.durationSeconds, pagesRead: s.pages.size, lastPage: s.lastPage }));
}

/** Lee el archivo de KOReader: libros con sus sesiones. */
export function readKoreader(path, { gapMinutes = DEFAULT_GAP_MINUTES } = {}) {
  const kdb = new DatabaseSync(path, { readOnly: true });
  try {
    const schema = inspectSchema(kdb);
    if (!schema.ok) return { schema, books: [] };
    const has = (c) => schema.columns.book.includes(c);
    const books = kdb
      .prepare(`SELECT id, title, ${has("authors") ? "authors" : "NULL AS authors"}, ${has("md5") ? "md5" : "NULL AS md5"}, ${has("pages") ? "pages" : "NULL AS pages"} FROM book`)
      .all();
    const rowsOf = kdb.prepare("SELECT page, start_time, duration FROM page_stat_data WHERE id_book = ? ORDER BY start_time");
    return {
      schema,
      books: books
        .map((b) => {
          const sessions = toSessions(rowsOf.all(b.id), gapMinutes);
          return {
            key: bookKey(b),
            title: b.title || "(sin título)",
            authors: b.authors || null,
            md5: b.md5 || null,
            pages: b.pages || null,
            sessions,
            totalSeconds: sessions.reduce((s, x) => s + x.durationSeconds, 0),
            pagesRead: sessions.reduce((s, x) => s + x.pagesRead, 0),
            firstRead: sessions[0] ? new Date(sessions[0].start * 1000).toISOString() : null,
            lastRead: sessions.at(-1) ? new Date(sessions.at(-1).start * 1000).toISOString() : null,
            lastPage: sessions.at(-1)?.lastPage ?? null,
          };
        })
        .filter((b) => b.sessions.length > 0),
    };
  } finally {
    kdb.close();
  }
}

/**
 * Para cada libro de KOReader, la obra de tu biblioteca que corresponde:
 * - "linked": ya se había vinculado antes (no pregunta de nuevo).
 * - "exact": mismo título (sin tildes ni mayúsculas, también contra el título original) y un autor
 *   en común, o un único libro con ese título.
 * - null: hay que elegir (se ofrecen candidatos parecidos).
 */
export function matchBooks(db, books) {
  const library = db
    .prepare("SELECT w.id AS workId, w.title, w.originalTitle, w.creators FROM works w JOIN library_entries e ON e.workId = w.id WHERE w.type = 'book'")
    .all()
    .map((w) => ({ ...w, creators: parseList(w.creators) }));
  const linkOf = db.prepare("SELECT workId FROM koreader_books WHERE key = ?");
  return books.map((b) => {
    const linked = linkOf.get(b.key)?.workId;
    if (linked && library.some((w) => w.workId === linked)) return { ...b, match: { workId: linked, confidence: "linked" }, candidates: [] };
    const t = norm(b.title);
    const theirs = lastNames(b.authors);
    const scored = library
      .map((w) => {
        const titles = [norm(w.title), norm(w.originalTitle)].filter(Boolean);
        const sameTitle = titles.includes(t);
        const partial = !sameTitle && titles.some((x) => x && (x.includes(t) || t.includes(x)));
        const authorHit = w.creators.some((c) => theirs.has(norm(c).split(" ").at(-1)));
        return { w, score: (sameTitle ? 3 : partial ? 1 : 0) + (authorHit ? 2 : 0), sameTitle, authorHit };
      })
      .filter((x) => x.score > 0)
      .sort((a, b2) => b2.score - a.score);
    const exact = scored.filter((x) => x.sameTitle && (x.authorHit || !x.w.creators.length || !theirs.size));
    const match = exact.length === 1 ? { workId: exact[0].w.workId, confidence: "exact" } : null;
    return { ...b, match, candidates: scored.slice(0, 3).map((x) => ({ workId: x.w.workId, title: x.w.title, creators: x.w.creators })) };
  });
}

/**
 * Importa con el mapeo elegido: { [bookKey]: workId | "new" | "skip" }.
 * "new" crea el libro en la biblioteca (leyendo). Devuelve un resumen.
 */
export function importKoreader(db, lib, books, mapping) {
  const summary = { books: 0, created: 0, skipped: 0, sessionsNew: 0, sessionsUpdated: 0 };
  const upsert = db.prepare(
    `INSERT INTO reading_sessions (workId, startTime, durationSeconds, pagesRead, source, externalKey, createdAt)
     VALUES (?, ?, ?, ?, 'koreader', ?, ?)
     ON CONFLICT(externalKey) DO UPDATE SET workId = excluded.workId, durationSeconds = excluded.durationSeconds, pagesRead = excluded.pagesRead`
  );
  const exists = db.prepare("SELECT durationSeconds, pagesRead, workId FROM reading_sessions WHERE externalKey = ?");
  const saveLink = db.prepare(
    `INSERT INTO koreader_books (key, title, authors, pages, workId, lastImportedAt) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET title = excluded.title, authors = excluded.authors, pages = excluded.pages, workId = excluded.workId, lastImportedAt = excluded.lastImportedAt`
  );
  const now = new Date().toISOString();
  for (const b of books) {
    let target = mapping[b.key];
    if (!target || target === "skip") {
      summary.skipped += 1;
      continue;
    }
    // "Nuevo" pero ya se creó en una importación anterior: se usa ese (no se duplica el libro).
    const previous = db.prepare("SELECT k.workId FROM koreader_books k JOIN works w ON w.id = k.workId WHERE k.key = ?").get(b.key)?.workId;
    if (target === "new" && previous) target = previous;
    if (target === "new") {
      const authors = b.authors ? String(b.authors).split(/\n/).map((a) => a.trim()).filter(Boolean) : [];
      const { item } = lib.add({
        work: { type: "book", title: b.title, creators: authors, metadata: b.pages ? { pages: b.pages } : {} },
        entry: { status: "in_progress", format: "Kindle · KOReader" },
        pass: { startedAt: b.firstRead ? localDate(b.firstRead) : undefined },
      });
      target = item.workId;
      summary.created += 1;
    }
    const workId = Number(target);
    db.exec("BEGIN");
    try {
      for (const s of b.sessions) {
        const key = `koreader:${b.key}:${s.start}`;
        const before = exists.get(key);
        upsert.run(workId, new Date(s.start * 1000).toISOString(), s.durationSeconds, s.pagesRead, key, now);
        if (!before) summary.sessionsNew += 1;
        else if (before.durationSeconds !== s.durationSeconds || before.pagesRead !== s.pagesRead || before.workId !== workId) summary.sessionsUpdated += 1;
      }
      saveLink.run(b.key, b.title, b.authors, b.pages, workId, now);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    // La fecha de inicio de la primera lectura: KOReader sabe cuándo empezaste de verdad (la app
    // pone "hoy" por defecto al pasar un libro a Leyendo).
    const entry = db.prepare("SELECT e.id FROM library_entries e WHERE e.workId = ?").get(workId);
    const pass = entry && lib.item(entry.id)?.currentPass;
    const firstDay = b.firstRead ? localDate(b.firstRead) : null;
    if (pass && firstDay && (!pass.startedAt || (pass.number === 1 && firstDay < pass.startedAt))) lib.updatePass(pass.id, { startedAt: firstDay });
    summary.books += 1;
  }
  return summary;
}
