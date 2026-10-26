// Salidas: CRUD sobre el modelo nuevo (fecha + hora opcional, con quién, estados tentativo /
// confirmado / fui / no fui). Las que están en Google Calendar se borran "suave" (deletedAt) para
// que la sincronización pueda borrar el evento allá también.
import { db, nowIso } from "../db/index.js";
import { OUTING_STATUSES, OUTING_CATEGORIES } from "../lib/ocio/constants.js";
import { handle } from "../lib/http.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const FIELDS = ["title", "category", "date", "startTime", "endTime", "allDay", "place", "withWhom", "notes", "status", "icon"];
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

/** Valida y normaliza un objeto de salida (completo o parcial). */
export function cleanOuting(input, { partial = false } = {}) {
  const out = {};
  for (const k of FIELDS) if (input[k] !== undefined) out[k] = input[k] === "" ? null : input[k];
  if (!partial || "title" in out) {
    if (!out.title?.trim()) throw bad("title_required");
    out.title = out.title.trim();
  }
  if (!partial || "date" in out) if (!DATE.test(out.date || "")) throw bad("date_required");
  if (out.status != null && !OUTING_STATUSES.includes(out.status)) throw bad("invalid_status");
  if (out.category != null && !OUTING_CATEGORIES.includes(out.category)) throw bad("invalid_category");
  for (const k of ["startTime", "endTime"]) if (out[k] != null && !TIME.test(out[k])) throw bad(`invalid_${k}`);
  if ("startTime" in out || "allDay" in out) out.allDay = out.startTime ? 0 : out.allDay === false || out.allDay === 0 ? 0 : 1;
  return out;
}

export function getOuting(id) {
  return db.prepare("SELECT * FROM outings WHERE id = ?").get(id);
}

export default function registerOutingsRoutes(app) {
  app.get(
    "/api/outings",
    handle((req) => {
      const { from, to, status } = req.query;
      const clauses = ["deletedAt IS NULL"];
      const params = [];
      if (from) (clauses.push("date >= ?"), params.push(from));
      if (to) (clauses.push("date <= ?"), params.push(to));
      if (status) (clauses.push("status = ?"), params.push(status));
      return db.prepare(`SELECT * FROM outings WHERE ${clauses.join(" AND ")} ORDER BY date, startTime`).all(...params);
    })
  );

  app.post(
    "/api/outings",
    handle((req) => {
      const o = cleanOuting(req.body);
      const ts = nowIso();
      const id = db
        .prepare(
          `INSERT INTO outings (title, category, date, startTime, endTime, allDay, place, withWhom, notes, status, icon, source, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'app', ?, ?)`
        )
        .run(o.title, o.category ?? null, o.date, o.startTime ?? null, o.endTime ?? null, o.allDay ?? 1, o.place ?? null, o.withWhom ?? null, o.notes ?? null, o.status ?? "tentative", o.icon ?? null, ts, ts)
        .lastInsertRowid;
      return getOuting(id);
    }, 201)
  );

  app.put(
    "/api/outings/:id",
    handle((req) => {
      const existing = getOuting(req.params.id);
      if (!existing || existing.deletedAt) throw Object.assign(new Error("not_found"), { status: 404 });
      const patch = cleanOuting(req.body, { partial: true });
      const merged = { ...existing, ...patch };
      db.prepare(
        `UPDATE outings SET title=?, category=?, date=?, startTime=?, endTime=?, allDay=?, place=?, withWhom=?, notes=?, status=?, icon=?, updatedAt=? WHERE id=?`
      ).run(merged.title, merged.category, merged.date, merged.startTime, merged.endTime, merged.allDay, merged.place, merged.withWhom, merged.notes, merged.status, merged.icon, nowIso(), existing.id);
      return getOuting(existing.id);
    })
  );

  app.delete(
    "/api/outings/:id",
    handle((req) => {
      const existing = getOuting(req.params.id);
      if (!existing) return;
      if (existing.googleEventId) db.prepare("UPDATE outings SET deletedAt = ?, updatedAt = ? WHERE id = ?").run(nowIso(), nowIso(), existing.id);
      else db.prepare("DELETE FROM outings WHERE id = ?").run(existing.id);
    })
  );
}
