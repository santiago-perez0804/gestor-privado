// Datos de la pantalla Inicio de Ocio, en una sola respuesta.
import { countByType, finishedByMonth, topGenres, averageRating, goalProjection, weekendRange, perMonth } from "../../lib/ocio/stats.js";

const parse = (t, f) => {
  try {
    return t ? JSON.parse(t) : f;
  } catch {
    return f;
  }
};

/** Todas las pasadas terminadas, con la obra (una relectura es otra fila). */
export function finishedRows(db) {
  return db
    .prepare(
      `SELECT p.finishedAt AS date, p.startedAt, w.type, w.title, w.genres, w.metadata, e.rating, e.id AS entryId
       FROM passes p JOIN library_entries e ON e.id = p.entryId JOIN works w ON w.id = e.workId
       WHERE p.status = 'done'`
    )
    .all()
    .map((r) => ({ ...r, genres: parse(r.genres, []), metadata: parse(r.metadata, {}) }));
}

/** Salidas activas (no borradas). */
export function activeOutings(db) {
  return db.prepare("SELECT * FROM outings WHERE deletedAt IS NULL ORDER BY date, startTime").all();
}

const PLANNED = new Set(["tentative", "confirmed"]);

/**
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {ReturnType<import("./library.js").createLibrary>} lib
 * @param {{ year: number, today: string }} opts
 */
export function buildHome(db, lib, { year, today }) {
  const items = lib.list();
  const all = finishedRows(db);
  const dated = all.filter((f) => f.date);
  const ofYear = dated.filter((f) => Number(f.date.slice(0, 4)) === year);
  const inProgress = items.filter((i) => i.status === "in_progress");
  const isCurrentYear = Number(today.slice(0, 4)) === year;

  const goals = Object.fromEntries(lib.goals(year).map((g) => [g.type, g.target]));
  const finishedCount = countByType(ofYear);
  const goalBook = goals.book
    ? isCurrentYear
      ? goalProjection({ done: finishedCount.book, target: goals.book, today })
      : { done: finishedCount.book, target: goals.book, ratio: Math.min(1, finishedCount.book / goals.book) }
    : null;

  const reviews = db
    .prepare(
      `SELECT r.id, r.text, r.hasSpoilers, r.createdAt, e.id AS entryId, e.rating, w.type, w.title, w.coverUrl, w.coverPath
       FROM reviews r JOIN library_entries e ON e.id = r.entryId JOIN works w ON w.id = e.workId
       ORDER BY r.createdAt DESC LIMIT 3`
    )
    .all()
    .map((r) => ({ ...r, cover: r.coverPath ? `/covers/${r.coverPath}` : r.coverUrl || null }));

  const outings = activeOutings(db);
  const weekend = weekendRange(today);
  const outingsOfYear = outings.filter((o) => o.date.startsWith(String(year)) && o.status !== "not_attended");

  return {
    year,
    today,
    finishedCount,
    inProgressCount: countByType(inProgress),
    moviesPerMonth: perMonth(finishedCount.movie, year, today),
    goals,
    goalBook,
    monthly: finishedByMonth(dated, year),
    totalFinished: ofYear.length,
    // Terminados sin fecha (p. ej. migrados): no entran en ningún mes; la UI invita a completarla.
    undated: all.filter((f) => !f.date).map((f) => ({ entryId: f.entryId, title: f.title, type: f.type })),
    genres: topGenres([...ofYear, ...inProgress], 5),
    averageRating: averageRating(ofYear),
    inProgress: inProgress.slice(0, 6),
    reviews,
    outings: {
      yearCount: outingsOfYear.length,
      thisWeekend: outings.filter((o) => PLANNED.has(o.status) && o.date >= weekend.from && o.date <= weekend.to).length,
      upcoming: outings.filter((o) => PLANNED.has(o.status) && o.date >= today).slice(0, 3),
      unconfirmed: outings.filter((o) => PLANNED.has(o.status) && o.date < today),
    },
    artworks: db.prepare("SELECT COUNT(*) AS n FROM artworks").get().n,
  };
}

/** Números para la barra lateral (cantidades por tipo, galería y salidas pendientes). */
export function sidebarCounts(db, today) {
  const byType = Object.fromEntries(
    db.prepare("SELECT w.type, COUNT(*) AS n FROM library_entries e JOIN works w ON w.id = e.workId GROUP BY w.type").all().map((r) => [r.type, r.n])
  );
  const all = Object.values(byType).reduce((s, n) => s + n, 0);
  const outings = db.prepare("SELECT COUNT(*) AS n FROM outings WHERE deletedAt IS NULL AND status IN ('tentative','confirmed') AND date >= ?").get(today).n;
  const artworks = db.prepare("SELECT COUNT(*) AS n FROM artworks").get().n;
  return { all, movie: byType.movie || 0, series: byType.series || 0, book: byType.book || 0, game: byType.game || 0, artworks, outings };
}
