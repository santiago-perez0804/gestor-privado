// Salidas: CRUD sobre el modelo nuevo (fecha + hora opcional, con quién, estados tentativo /
// confirmado / fui / no fui). Las que están en Google Calendar se borran "suave" (deletedAt) para
// que la sincronización pueda borrar el evento allá también.
import { db, nowIso } from "../db/index.js";
import { OUTING_STATUSES, OUTING_CATEGORIES } from "../lib/ocio/constants.js";
import { handle } from "../lib/http.js";
import { createOutings } from "../services/ocio/outings.js";
import { parseOuting } from "../lib/ocio/parseOuting.js";
import { todayLocal } from "../services/ocio/library.js";
import { google } from "../services/google/index.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Fecha de calendario real (2026-02-30 o 2026-13-45 no). */
function realDate(s) {
  if (!DATE.test(s || "")) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
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
  if (!partial || "date" in out) if (!realDate(out.date)) throw bad(out.date ? "invalid_date" : "date_required");
  if (out.status != null && !OUTING_STATUSES.includes(out.status)) throw bad("invalid_status");
  if (out.category != null && !OUTING_CATEGORIES.includes(out.category)) throw bad("invalid_category");
  for (const k of ["startTime", "endTime"]) if (out[k] != null && !TIME.test(out[k])) throw bad(`invalid_${k}`);
  if ("startTime" in out || "allDay" in out) out.allDay = out.startTime ? 0 : out.allDay === false || out.allDay === 0 ? 0 : 1;
  return out;
}

export async function getOuting(id) {
  return await db.prepare("SELECT * FROM outings WHERE id = ?").get(id);
}

export default function registerOutingsRoutes(app) {
  const outings = createOutings(db);

  // Con lo gastado en cada salida (gastos vinculados) y cuántos gastos tiene.
  app.get("/api/outings", handle((req) => outings.list(req.query)));

  // Números de la pantalla Salidas: ?month=YYYY-MM (por defecto el actual).
  app.get(
    "/api/outings/summary",
    handle((req) => {
      const today = todayLocal();
      const month = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : today.slice(0, 7);
      return outings.summary({ month, today });
    })
  );

  // Carga rápida en lenguaje natural: devuelve la vista previa, no guarda nada.
  app.post("/api/outings/parse", handle((req) => parseOuting(String(req.body?.text || ""), todayLocal())));

  // Para un gasto recién cargado (pantalla Finanzas): ¿va con alguna salida?
  app.get(
    "/api/outings/suggest",
    handle((req) => {
      const { date, title, description, expenseId } = req.query;
      return outings.suggestForExpense({ date, title, description, expenseId: expenseId ? Number(expenseId) : null });
    })
  );

  app.get("/api/outings/:id/expenses", handle((req) => outings.linked(Number(req.params.id))));
  app.get(
    "/api/outings/:id/expense-candidates",
    handle(async (req) => {
      const list = await outings.candidates(Number(req.params.id));
      if (!list) throw Object.assign(new Error("not_found"), { status: 404 });
      return list;
    })
  );
  app.post("/api/outings/:id/expenses", handle((req) => outings.link(Number(req.params.id), Number(req.body?.expenseId)), 201));
  app.delete("/api/outings/:id/expenses/:expenseId", handle((req) => outings.unlink(Number(req.params.id), Number(req.params.expenseId))));

  app.post(
    "/api/outings",
    handle(async (req) => {
      const o = cleanOuting(req.body);
      const ts = nowIso();
      const id = (await db
        .prepare(
          `INSERT INTO outings (title, category, date, startTime, endTime, allDay, place, withWhom, notes, status, icon, source, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'app', ?, ?)`
        )
        .run(o.title, o.category ?? null, o.date, o.startTime ?? null, o.endTime ?? null, o.allDay ?? 1, o.place ?? null, o.withWhom ?? null, o.notes ?? null, o.status ?? "tentative", o.icon ?? null, ts, ts))
        .lastInsertRowid;
      google().scheduleSoon().catch(() => {});
      return await getOuting(id);
    }, 201)
  );

  app.put(
    "/api/outings/:id",
    handle(async (req) => {
      const existing = await getOuting(req.params.id);
      if (!existing || existing.deletedAt) throw Object.assign(new Error("not_found"), { status: 404 });
      const patch = cleanOuting(req.body, { partial: true });
      const merged = { ...existing, ...patch };
      await db.prepare(
        `UPDATE outings SET title=?, category=?, date=?, startTime=?, endTime=?, allDay=?, place=?, withWhom=?, notes=?, status=?, icon=?, updatedAt=? WHERE id=?`
      ).run(merged.title, merged.category, merged.date, merged.startTime, merged.endTime, merged.allDay, merged.place, merged.withWhom, merged.notes, merged.status, merged.icon, nowIso(), existing.id);
      google().scheduleSoon().catch(() => {});
      return await getOuting(existing.id);
    })
  );

  app.delete(
    "/api/outings/:id",
    handle(async (req) => {
      const existing = await getOuting(req.params.id);
      if (!existing) return;
      if (existing.googleEventId) await db.prepare("UPDATE outings SET deletedAt = ?, updatedAt = ? WHERE id = ?").run(nowIso(), nowIso(), existing.id);
      else await db.prepare("DELETE FROM outings WHERE id = ?").run(existing.id);
      google().scheduleSoon().catch(() => {});
    })
  );
}
