// Estadísticas de Ocio por año y por tipo, y el "Resumen anual". Se cachean y se recalculan solo
// cuando cambian los datos (una huella barata de las tablas que intervienen).
import { finishedRows, activeOutings } from "./home.js";
import { todayLocal } from "./library.js";
import { countByType, finishedByMonth, topGenres, averageRating, goalProjection, readingStats, bookRecords, perMonth } from "../../lib/ocio/stats.js";

const TYPES = ["movie", "series", "book", "game"];

export function createOcioStats(db, lib) {
  const cache = new Map();

  /** Huella de los datos: si no cambió, se devuelve lo calculado antes. */
  async function dataVersion() {
    return (await db
      .prepare(
        `SELECT
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updatedAt), '') FROM library_entries) || '|' ||
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updatedAt), '') FROM passes) || '|' ||
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updatedAt), '') FROM works) || '|' ||
          (SELECT COUNT(*) || ':' || IFNULL(SUM(durationSeconds), 0) || ':' || IFNULL(SUM(pagesRead), 0) FROM reading_sessions) || '|' ||
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updatedAt), '') FROM outings) || '|' ||
          (SELECT COUNT(*) FROM outing_expenses) || '|' ||
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updatedAt), '') FROM reviews) || '|' ||
          (SELECT COUNT(*) FROM artworks) || '|' ||
          (SELECT COUNT(*) || ':' || IFNULL(SUM(target), 0) FROM ocio_goals) AS v`
      )
      .get()).v;
  }

  async function memo(key, compute) {
    const v = await dataVersion();
    const hit = cache.get(key);
    if (hit && hit.v === v) return hit.value;
    const value = await compute();
    cache.set(key, { v, value });
    return value;
  }

  const sessions = async () => await db.prepare("SELECT workId, startTime, durationSeconds, pagesRead FROM reading_sessions ORDER BY startTime").all();
  const finishedOfYear = async (year) => (await finishedRows(db)).filter((f) => f.date && Number(f.date.slice(0, 4)) === year);

  async function perType(year, type) {
    const today = todayLocal();
    const done = (await finishedOfYear(year)).filter((f) => f.type === type);
    const items = await lib.list({ type });
    const creators = new Map();
    for (const f of done) {
      const it = items.find((i) => i.id === f.entryId);
      for (const c of it?.creators || []) creators.set(c, (creators.get(c) || 0) + 1);
    }
    const hours =
      type === "movie"
        ? done.reduce((s, f) => s + (f.metadata?.runtime || 0), 0) / 60
        : type === "game"
          ? items.filter((i) => done.some((f) => f.entryId === i.id)).reduce((s, i) => s + (i.currentPass?.progress?.unit === "hours" ? i.currentPass.progress.current || 0 : 0), 0)
          : null;
    return {
      finished: done.length,
      perMonth: perMonth(done.length, year, today),
      monthly: finishedByMonth(done, year).map((m) => m.total),
      averageRating: averageRating(done),
      genres: topGenres(done, 6),
      hours: hours == null ? null : Math.round(hours),
      inProgress: items.filter((i) => i.status === "in_progress").length,
      want: items.filter((i) => i.status === "want").length,
      topCreators: [...creators].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })),
      best: [...done].filter((f) => f.rating).sort((a, b) => b.rating - a.rating).slice(0, 3).map((f) => ({ entryId: f.entryId, title: f.title, cover: f.cover, rating: f.rating, date: f.date })),
    };
  }

  async function bookStats(year) {
    const today = todayLocal();
    const done = (await finishedOfYear(year)).filter((f) => f.type === "book");
    const reading = readingStats(await sessions(), { year, today });
    const target = (await lib.goals(year)).find((g) => g.type === "book")?.target ?? null;
    const isCurrent = Number(today.slice(0, 4)) === year;
    // Géneros de los libros que "tocaste" este año: terminados o con lectura en el año, o en curso.
    const readIds = new Set((await sessions()).filter((s) => new Date(s.startTime).getFullYear() === year).map((s) => s.workId));
    const touched = (await lib.list({ type: "book" })).filter((i) => readIds.has(i.workId) || done.some((f) => f.entryId === i.id) || (isCurrent && i.status === "in_progress"));
    const titleOf = async (workId) => (await lib.list({ type: "book" })).find((i) => i.workId === workId)?.title ?? null;
    return {
      ...await perType(year, "book"),
      goal: target ? (isCurrent ? goalProjection({ done: done.length, target, today }) : { done: done.length, target, ratio: Math.min(1, done.length / target) }) : null,
      reading: { ...reading, recordDay: reading.recordDay ? { ...reading.recordDay, title: await titleOf(reading.recordDay.workId) } : null },
      records: bookRecords(done),
      genres: topGenres(touched, 6),
      touched: touched.length,
    };
  }

  async function general(year) {
    const done = await finishedOfYear(year);
    const outings = (await activeOutings(db)).filter((o) => o.date.startsWith(String(year)) && o.status !== "not_attended");
    const outingsMonthly = Array(12).fill(0);
    for (const o of outings) {
      const m = Number(o.date.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) outingsMonthly[m] += 1; // una fecha rota no desarma el gráfico
    }
    return {
      finishedCount: countByType(done),
      totalFinished: done.length,
      monthly: finishedByMonth(done, year),
      averageRating: averageRating(done),
      genres: topGenres(done, 8),
      outingsMonthly,
      outingsCount: outings.length,
    };
  }

  /** Estadísticas de un año, en general o de un tipo. */
  async function stats(year, type) {
    return await memo(`stats:${year}:${type || "general"}`, async () => {
      if (type === "book") return { year, type, ...await bookStats(year) };
      if (TYPES.includes(type)) return { year, type, ...await perType(year, type) };
      return { year, type: "general", ...await general(year) };
    });
  }

  /** Todo lo del "Resumen anual" de una vez. */
  async function wrapped(year) {
    return await memo(`wrapped:${year}`, async () => {
      const today = todayLocal();
      const done = (await finishedOfYear(year)).sort((a, b) => a.date.localeCompare(b.date));
      const g = await general(year);
      const reading = readingStats(await sessions(), { year, today });
      const outings = (await activeOutings(db)).filter((o) => o.date.startsWith(String(year)) && o.status !== "not_attended");
      const cats = new Map();
      for (const o of outings) if (o.category) cats.set(o.category, (cats.get(o.category) || 0) + 1);
      const [topCat, topCatCount] = [...cats].sort((a, b) => b[1] - a[1])[0] || [];
      const spent = (await db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE id IN (
             SELECT oe.expenseId FROM outing_expenses oe JOIN outings o ON o.id = oe.outingId WHERE o.deletedAt IS NULL AND o.date LIKE ?)`
        )
        .get(`${year}-%`)).total;
      const favoriteMonth = g.monthly.reduce((best, m) => (m.total > (best?.total ?? 0) ? m : best), null);
      const night = reading.hourBuckets.filter((b) => b.id === "night" || b.id === "late").reduce((s, b) => s + b.share, 0);
      return {
        year,
        totalFinished: g.totalFinished,
        finishedCount: g.finishedCount,
        topGenre: g.genres[0] ?? null,
        averageRating: g.averageRating,
        best: [...done].filter((f) => f.rating).sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date)).slice(0, 3).map((f) => ({ entryId: f.entryId, title: f.title, type: f.type, cover: f.cover, rating: f.rating })),
        favoriteMonth: favoriteMonth?.total ? { month: favoriteMonth.month, total: favoriteMonth.total } : null,
        first: done[0] ? { title: done[0].title, type: done[0].type, cover: done[0].cover, date: done[0].date } : null,
        last: done.at(-1) ? { title: done.at(-1).title, type: done.at(-1).type, cover: done.at(-1).cover, date: done.at(-1).date } : null,
        reading: { pages: reading.pages, hours: Math.round(reading.seconds / 3600), bestStreak: reading.bestStreak, daysWithReading: reading.daysWithReading, pagesPerHour: reading.pagesPerHour, nightShare: night },
        movieHours: Math.round(done.filter((f) => f.type === "movie").reduce((s, f) => s + (f.metadata?.runtime || 0), 0) / 60),
        outings: { count: outings.length, topCategory: topCat ? { id: topCat, count: topCatCount } : null, spent },
        artworks: (await db.prepare("SELECT COUNT(*) AS n FROM artworks WHERE createdOn LIKE ? OR (createdOn IS NULL AND createdAt LIKE ?)").get(`${year}%`, `${year}%`)).n,
      };
    });
  }

  return { stats, wrapped, dataVersion };
}
