// Biblioteca de Ocio: obras, tu entrada por obra y sus pasadas (lecturas / visionados / partidas).
// Recibe la base por parámetro para poder testearla con una base en memoria.
import { ENTRY_STATUSES, WORK_TYPES } from "../../lib/ocio/constants.js";

/** @typedef {{ unit?: string, current?: number, total?: number, season?: number, note?: string }} Progress */
/**
 * @typedef {object} LibraryItem
 * @property {number} id            id de la entrada (es el id que usa el frontend)
 * @property {number} workId
 * @property {"movie"|"series"|"book"|"game"} type
 * @property {string} title
 * @property {string[]} creators
 * @property {string[]} genres
 * @property {string|null} cover    URL lista para usar (local si se descargó)
 * @property {"want"|"in_progress"|"done"|"dropped"} status
 * @property {number|null} rating
 * @property {object|null} currentPass  la pasada abierta o, si no hay, la última
 * @property {number} timesFinished
 */

const parse = (text, fallback) => {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
};
const nowIso = () => new Date().toISOString();
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });
const notFound = () => Object.assign(new Error("not_found"), { status: 404 });

/** Fecha YYYY-MM-DD de calendario real, o null si viene vacía. */
function cleanDate(value, field) {
  if (value == null || value === "") return null;
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw badRequest(`invalid_${field}`);
  return s;
}

/** Puntuación válida: vacía, o de 0,5 a 5 en pasos de media estrella. */
function cleanRating(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!(n >= 0.5 && n <= 5 && Number.isInteger(n * 2))) throw badRequest("invalid_rating");
  return n;
}
const pad = (n) => String(n).padStart(2, "0");
/** Fecha local de hoy (YYYY-MM-DD): las fechas de inicio/fin son del día en tu zona horaria. */
export function todayLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const WORK_FIELDS = ["type", "title", "originalTitle", "creators", "year", "genres", "coverUrl", "coverPath", "externalSource", "externalId", "metadata"];
const ENTRY_FIELDS = ["rating", "priority", "recommendedBy", "format", "notes"];

function rowToPass(p) {
  return p && { ...p, progress: parse(p.progress, {}) };
}

export function createLibrary(db) {
  const q = {
    work: db.prepare("SELECT * FROM works WHERE id = ?"),
    entry: db.prepare("SELECT * FROM library_entries WHERE id = ?"),
    entryByWork: db.prepare("SELECT * FROM library_entries WHERE workId = ?"),
    passesOf: db.prepare("SELECT * FROM passes WHERE entryId = ? ORDER BY number"),
    pass: db.prepare("SELECT * FROM passes WHERE id = ?"),
    byExternal: db.prepare("SELECT * FROM works WHERE externalSource = ? AND externalId = ?"),
  };

  function serialize(work, entry, passes) {
    const open = passes.filter((p) => p.status === "in_progress").at(-1);
    const done = passes.filter((p) => p.status === "done");
    return {
      id: entry.id,
      workId: work.id,
      type: work.type,
      title: work.title,
      originalTitle: work.originalTitle,
      creators: parse(work.creators, []),
      year: work.year,
      genres: parse(work.genres, []),
      cover: work.coverPath ? `/covers/${work.coverPath}` : work.coverUrl || null,
      externalSource: work.externalSource,
      externalId: work.externalId,
      metadata: parse(work.metadata, {}),
      status: entry.status,
      rating: entry.rating,
      priority: entry.priority,
      recommendedBy: entry.recommendedBy,
      format: entry.format,
      notes: entry.notes,
      currentPass: rowToPass(open ?? passes.at(-1) ?? null),
      passCount: passes.length,
      timesFinished: done.length,
      lastFinishedAt: done.map((p) => p.finishedAt).filter(Boolean).sort().at(-1) ?? null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  /** @returns {LibraryItem} */
  function item(entryId) {
    const entry = q.entry.get(entryId);
    if (!entry) return null;
    return serialize(q.work.get(entry.workId), entry, q.passesOf.all(entry.id));
  }

  /** Toda la biblioteca (para una colección personal alcanza con armarla en memoria). */
  function list({ type, status, q: text } = {}) {
    const works = new Map(db.prepare("SELECT * FROM works").all().map((w) => [w.id, w]));
    const passesByEntry = new Map();
    for (const p of db.prepare("SELECT * FROM passes ORDER BY entryId, number").all()) {
      if (!passesByEntry.has(p.entryId)) passesByEntry.set(p.entryId, []);
      passesByEntry.get(p.entryId).push(p);
    }
    const needle = norm(text);
    return db
      .prepare("SELECT * FROM library_entries ORDER BY updatedAt DESC")
      .all()
      .map((e) => serialize(works.get(e.workId), e, passesByEntry.get(e.id) ?? []))
      .filter((it) => (!type || it.type === type) && (!status || it.status === status))
      .filter((it) => !needle || norm([it.title, it.originalTitle, ...it.creators, ...it.genres].join(" ")).includes(needle));
  }

  /**
   * ¿Ya está en la biblioteca? Por id externo (coincidencia segura) o por tipo + título normalizado
   * (el original también cuenta) + año ±1 + algún autor en común si los dos tienen autores.
   * @returns {LibraryItem|null} con `match`: "id" (segura) o "title" (probable)
   */
  function findDuplicate({ type, title, originalTitle, year, creators, externalSource, externalId }) {
    if (externalSource && externalId) {
      const w = q.byExternal.get(externalSource, String(externalId));
      if (w) {
        const e = q.entryByWork.get(w.id);
        if (e) return { ...item(e.id), match: "id" };
      }
    }
    const titles = [norm(title), norm(originalTitle)].filter(Boolean);
    if (!titles.length) return null;
    const lastNames = (list) => new Set((list || []).map((c) => norm(c).split(" ").at(-1)).filter(Boolean));
    const theirs = lastNames(creators);
    const hit = db
      .prepare("SELECT * FROM works WHERE type = ?")
      .all(type)
      .find((w) => {
        if (!titles.includes(norm(w.title)) && !titles.includes(norm(w.originalTitle))) return false;
        if (year && w.year && Math.abs(w.year - year) > 1) return false;
        const ours = lastNames(parse(w.creators, []));
        return !ours.size || !theirs.size || [...ours].some((n) => theirs.has(n));
      });
    if (!hit) return null;
    const e = q.entryByWork.get(hit.id);
    return e ? { ...item(e.id), match: "title" } : null;
  }

  function insertWork(work, ts) {
    if (!WORK_TYPES.includes(work.type)) throw Object.assign(new Error("invalid_type"), { status: 400 });
    if (!work.title?.trim()) throw Object.assign(new Error("title_required"), { status: 400 });
    return db
      .prepare(
        `INSERT INTO works (type, title, originalTitle, creators, year, genres, coverUrl, coverPath, externalSource, externalId, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        work.type,
        work.title.trim(),
        work.originalTitle ?? null,
        JSON.stringify(work.creators ?? []),
        work.year ?? null,
        JSON.stringify(work.genres ?? []),
        work.coverUrl ?? null,
        work.coverPath ?? null,
        work.externalSource ?? null,
        work.externalId != null ? String(work.externalId) : null,
        JSON.stringify(work.metadata ?? {}),
        ts,
        ts
      ).lastInsertRowid;
  }

  function updateWork(workId, patch) {
    const current = q.work.get(workId);
    if (!current) throw Object.assign(new Error("not_found"), { status: 404 });
    const merged = { ...current };
    for (const k of WORK_FIELDS) {
      if (patch[k] === undefined) continue;
      merged[k] = ["creators", "genres", "metadata"].includes(k) ? JSON.stringify(patch[k]) : patch[k];
    }
    db.prepare(
      `UPDATE works SET type=?, title=?, originalTitle=?, creators=?, year=?, genres=?, coverUrl=?, coverPath=?, externalSource=?, externalId=?, metadata=?, updatedAt=? WHERE id=?`
    ).run(
      merged.type,
      merged.title,
      merged.originalTitle,
      merged.creators,
      merged.year,
      merged.genres,
      merged.coverUrl,
      merged.coverPath,
      merged.externalSource,
      merged.externalId,
      merged.metadata,
      nowIso(),
      workId
    );
  }

  function touch(entryId) {
    db.prepare("UPDATE library_entries SET updatedAt = ? WHERE id = ?").run(nowIso(), entryId);
  }

  /**
   * Cambia el estado y mantiene las pasadas coherentes:
   * empezar abre una pasada (o reabre la última si estaba abandonada o recién terminada),
   * terminar / abandonar cierran la abierta (o crean una si no había), y volver a "quiero"
   * descarta una pasada abierta sin progreso.
   */
  function setStatus(entryId, next, { date, dropReason } = {}) {
    if (!ENTRY_STATUSES.includes(next)) throw Object.assign(new Error("invalid_status"), { status: 400 });
    const entry = q.entry.get(entryId);
    if (!entry) throw Object.assign(new Error("not_found"), { status: 404 });
    const day = cleanDate(date, "date") || todayLocal();
    const ts = nowIso();
    const passes = q.passesOf.all(entryId);
    const open = passes.filter((p) => p.status === "in_progress").at(-1);
    const last = passes.at(-1);
    const newPass = (status, fields = {}) =>
      db
        .prepare("INSERT INTO passes (entryId, number, status, startedAt, finishedAt, progress, dropReason, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?)")
        .run(entryId, (last?.number ?? 0) + 1, status, fields.startedAt ?? null, fields.finishedAt ?? null, fields.dropReason ?? null, ts, ts);
    const updatePassRow = (id, fields) => {
      const sets = Object.keys(fields).map((k) => `${k} = ?`);
      db.prepare(`UPDATE passes SET ${sets.join(", ")}, updatedAt = ? WHERE id = ?`).run(...Object.values(fields), ts, id);
    };

    if (next === "in_progress" && !open) {
      if (last && (last.status === "dropped" || (last.status === "done" && entry.status === "done"))) {
        updatePassRow(last.id, { status: "in_progress", finishedAt: null, dropReason: null });
      } else newPass("in_progress", { startedAt: day });
    } else if (next === "done") {
      if (open) updatePassRow(open.id, { status: "done", finishedAt: day });
      else if (last && last.status === "dropped") updatePassRow(last.id, { status: "done", finishedAt: day, dropReason: null });
      else if (!last || entry.status !== "done") newPass("done", { finishedAt: day });
    } else if (next === "dropped") {
      if (open) updatePassRow(open.id, { status: "dropped", finishedAt: day, dropReason: dropReason ?? null });
      else if (!last || entry.status === "want") newPass("dropped", { finishedAt: day, dropReason });
    } else if (next === "want" && open) {
      const progress = parse(open.progress, {});
      if (progress.current == null) db.prepare("DELETE FROM passes WHERE id = ?").run(open.id);
      else updatePassRow(open.id, { status: "dropped", finishedAt: day });
    }
    db.prepare("UPDATE library_entries SET status = ?, updatedAt = ? WHERE id = ?").run(next, ts, entryId);
    return item(entryId);
  }

  /** Releer / volver a ver: una pasada nueva (la anterior queda en el historial). */
  function reread(entryId, { date: rawDate } = {}) {
    const date = cleanDate(rawDate, "date");
    const entry = q.entry.get(entryId);
    if (!entry) throw Object.assign(new Error("not_found"), { status: 404 });
    const passes = q.passesOf.all(entryId);
    const open = passes.find((p) => p.status === "in_progress");
    const ts = nowIso();
    if (open) db.prepare("UPDATE passes SET status = 'done', finishedAt = COALESCE(finishedAt, ?), updatedAt = ? WHERE id = ?").run(date || todayLocal(), ts, open.id);
    db.prepare("INSERT INTO passes (entryId, number, status, startedAt, progress, createdAt, updatedAt) VALUES (?, ?, 'in_progress', ?, '{}', ?, ?)").run(
      entryId,
      (passes.at(-1)?.number ?? 0) + 1,
      date || todayLocal(),
      ts,
      ts
    );
    db.prepare("UPDATE library_entries SET status = 'in_progress', updatedAt = ? WHERE id = ?").run(ts, entryId);
    return item(entryId);
  }

  function updateEntry(entryId, patch = {}) {
    if (patch.rating !== undefined) patch = { ...patch, rating: cleanRating(patch.rating) };
    const entry = q.entry.get(entryId);
    if (!entry) throw Object.assign(new Error("not_found"), { status: 404 });
    db.exec("BEGIN");
    try {
      if (patch.work) updateWork(entry.workId, patch.work);
      const merged = { ...entry };
      for (const k of ENTRY_FIELDS) if (patch[k] !== undefined) merged[k] = patch[k];
      db.prepare("UPDATE library_entries SET rating=?, priority=?, recommendedBy=?, format=?, notes=?, updatedAt=? WHERE id=?").run(
        merged.rating,
        merged.priority,
        merged.recommendedBy,
        merged.format,
        merged.notes,
        nowIso(),
        entryId
      );
      if (patch.status && patch.status !== entry.status) setStatus(entryId, patch.status, { date: patch.statusDate, dropReason: patch.dropReason });
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return item(entryId);
  }

  function updatePass(passId, patch = {}) {
    const pass = q.pass.get(passId);
    if (!pass) throw Object.assign(new Error("not_found"), { status: 404 });
    const merged = { ...pass, progress: parse(pass.progress, {}) };
    for (const k of ["startedAt", "finishedAt"]) if (patch[k] !== undefined) merged[k] = cleanDate(patch[k], k);
    if (patch.dropReason !== undefined) merged.dropReason = patch.dropReason;
    if (patch.progress) merged.progress = { ...merged.progress, ...patch.progress };
    db.prepare("UPDATE passes SET startedAt=?, finishedAt=?, dropReason=?, progress=?, updatedAt=? WHERE id=?").run(
      merged.startedAt,
      merged.finishedAt,
      merged.dropReason,
      JSON.stringify(merged.progress),
      nowIso(),
      passId
    );
    touch(pass.entryId);
    return item(pass.entryId);
  }

  /**
   * Alta en la biblioteca. Si la obra ya estaba (mismo id externo, o mismo título y año),
   * actualiza esa entrada en vez de duplicarla.
   * @param {{ work: object, entry?: object, pass?: { startedAt?: string, finishedAt?: string, progress?: Progress }, review?: { text: string, hasSpoilers?: boolean } }} input
   * @returns {{ item: LibraryItem, existed: boolean }}
   */
  function add({ work, entry = {}, pass, review } = {}) {
    if (!work || typeof work !== "object") throw badRequest("work_required");
    if (entry.rating !== undefined) entry = { ...entry, rating: cleanRating(entry.rating) };
    const duplicate = findDuplicate(work);
    const ts = nowIso();
    let entryId;
    db.exec("BEGIN");
    try {
      if (duplicate) {
        entryId = duplicate.id;
        // Completar datos de catálogo que falten (p. ej. una obra cargada a mano que ahora tiene portada).
        const patch = {};
        for (const k of WORK_FIELDS) {
          const had = duplicate[k === "coverUrl" ? "cover" : k];
          const empty = had == null || (Array.isArray(had) && had.length === 0);
          if (work[k] != null && empty) patch[k] = work[k];
        }
        if (Object.keys(patch).length) updateWork(duplicate.workId, patch);
      } else {
        const workId = insertWork(work, ts);
        entryId = db
          .prepare("INSERT INTO library_entries (workId, status, createdAt, updatedAt) VALUES (?, 'want', ?, ?)")
          .run(workId, ts, ts).lastInsertRowid;
      }
      const fields = {};
      for (const k of ENTRY_FIELDS) if (entry[k] !== undefined) fields[k] = entry[k];
      if (Object.keys(fields).length) {
        const sets = Object.keys(fields).map((k) => `${k} = ?`);
        db.prepare(`UPDATE library_entries SET ${sets.join(", ")}, updatedAt = ? WHERE id = ?`).run(...Object.values(fields), ts, entryId);
      }
      const status = entry.status ?? (duplicate ? duplicate.status : "want");
      const date = status === "done" ? pass?.finishedAt : pass?.startedAt;
      if (status !== (duplicate?.status ?? "want")) setStatus(entryId, status, { date });
      const current = item(entryId).currentPass;
      if (current && pass && (pass.startedAt || pass.finishedAt || pass.progress)) {
        updatePass(current.id, { startedAt: pass.startedAt, finishedAt: pass.finishedAt, progress: pass.progress });
      }
      if (review?.text?.trim()) addReview(entryId, review);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return { item: item(entryId), existed: !!duplicate };
  }

  function remove(entryId) {
    const entry = q.entry.get(entryId);
    if (!entry) return;
    db.prepare("DELETE FROM works WHERE id = ?").run(entry.workId); // en cascada: entrada, pasadas, reseñas, subrayados, sesiones
  }

  // ---------- reseñas, subrayados, metas ----------
  function addReview(entryId, { text, hasSpoilers = false }) {
    if (!q.entry.get(entryId)) throw notFound();
    const ts = nowIso();
    const passes = q.passesOf.all(entryId);
    const passId = passes.at(-1)?.id ?? null;
    const id = db
      .prepare("INSERT INTO reviews (entryId, passId, text, hasSpoilers, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
      .run(entryId, passId, text.trim(), hasSpoilers ? 1 : 0, ts, ts).lastInsertRowid;
    touch(entryId);
    return db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  }

  function updateReview(id, { text, hasSpoilers }) {
    const r = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
    if (!r) throw Object.assign(new Error("not_found"), { status: 404 });
    db.prepare("UPDATE reviews SET text = ?, hasSpoilers = ?, updatedAt = ? WHERE id = ?").run(
      text?.trim() ?? r.text,
      hasSpoilers === undefined ? r.hasSpoilers : hasSpoilers ? 1 : 0,
      nowIso(),
      id
    );
    return db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  }

  function addHighlight(workId, { text, location, note, source = "manual" } = {}) {
    if (!text?.trim()) throw badRequest("text_required");
    if (!db.prepare("SELECT 1 FROM works WHERE id = ?").get(workId)) throw notFound();
    const id = db
      .prepare("INSERT INTO highlights (workId, text, location, note, source, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
      .run(workId, text.trim(), location ?? null, note ?? null, source, nowIso()).lastInsertRowid;
    return db.prepare("SELECT * FROM highlights WHERE id = ?").get(id);
  }

  /** Detalle de una entrada: pasadas, reseñas, subrayados, sesiones por día y obras relacionadas. */
  function detail(entryId) {
    const it = item(entryId);
    if (!it) return null;
    const passes = q.passesOf.all(entryId).map(rowToPass);
    const reviews = db.prepare("SELECT * FROM reviews WHERE entryId = ? ORDER BY createdAt DESC").all(entryId);
    const highlights = db.prepare("SELECT * FROM highlights WHERE workId = ? ORDER BY createdAt").all(it.workId);
    const sessions = db.prepare("SELECT startTime, durationSeconds, pagesRead, source FROM reading_sessions WHERE workId = ? ORDER BY startTime").all(it.workId);
    const others = list().filter((o) => o.id !== it.id);
    const shared = (o) => o.genres.filter((g) => it.genres.includes(g)).length + (o.creators.some((c) => it.creators.includes(c)) ? 2 : 0);
    const related = others
      .map((o) => ({ o, score: shared(o) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.o);
    return { item: it, passes, reviews, highlights, sessions, related };
  }

  function goals(year) {
    return db.prepare("SELECT type, target FROM ocio_goals WHERE year = ?").all(year).map((g) => ({ type: g.type, target: g.target }));
  }

  function setGoal(year, type, target) {
    if (![...WORK_TYPES, "outing"].includes(type)) throw badRequest("invalid_type");
    if (!Number.isInteger(year) || !Number.isInteger(target) || target < 0) throw badRequest("invalid_goal");
    if (!target) db.prepare("DELETE FROM ocio_goals WHERE year = ? AND type = ?").run(year, type);
    else db.prepare("INSERT INTO ocio_goals (year, type, target) VALUES (?, ?, ?) ON CONFLICT(year, type) DO UPDATE SET target = excluded.target").run(year, type, target);
    return goals(year);
  }

  return { list, item, detail, add, findDuplicate, updateEntry, updateWork, setStatus, reread, updatePass, remove, addReview, updateReview, addHighlight, goals, setGoal };
}
