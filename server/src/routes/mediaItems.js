import { db, nowIso } from "../db/index.js";

export default function registerMediaItemsRoutes(app) {
  app.get("/api/media-items", (req, res) => {
    const { type, status } = req.query;
    const clauses = [];
    const params = [];
    if (type) {
      clauses.push("type = ?");
      params.push(type);
    }
    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    res.json(db.prepare(`SELECT * FROM media_items ${where} ORDER BY updatedAt DESC`).all(...params));
  });

  app.get("/api/media-items/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM media_items WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  });

  app.post("/api/media-items", (req, res) => {
    const {
      type,
      title,
      status,
      rating,
      notes,
      startedAt,
      finishedAt,
      progressCurrent,
      progressTotal,
      progressLabel,
      icon,
    } = req.body;
    if (!type || !title) return res.status(400).json({ error: "type_title_required" });
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO media_items
          (type, title, status, rating, notes, startedAt, finishedAt, progressCurrent, progressTotal, progressLabel, icon, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        type,
        title,
        status ?? "pendiente",
        rating ?? null,
        notes ?? null,
        startedAt ?? null,
        finishedAt ?? null,
        progressCurrent ?? null,
        progressTotal ?? null,
        progressLabel ?? null,
        icon ?? null,
        ts,
        ts
      );
    res.status(201).json(db.prepare("SELECT * FROM media_items WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/media-items/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM media_items WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const merged = { ...existing };
    for (const key of [
      "title",
      "status",
      "rating",
      "notes",
      "startedAt",
      "finishedAt",
      "progressCurrent",
      "progressTotal",
      "progressLabel",
      "icon",
    ]) {
      if (req.body[key] !== undefined) merged[key] = req.body[key];
    }
    db.prepare(
      `UPDATE media_items SET title=?, status=?, rating=?, notes=?, startedAt=?, finishedAt=?,
       progressCurrent=?, progressTotal=?, progressLabel=?, icon=?, updatedAt=? WHERE id=?`
    ).run(
      merged.title,
      merged.status,
      merged.rating,
      merged.notes,
      merged.startedAt,
      merged.finishedAt,
      merged.progressCurrent,
      merged.progressTotal,
      merged.progressLabel,
      merged.icon,
      nowIso(),
      req.params.id
    );
    res.json(db.prepare("SELECT * FROM media_items WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/media-items/:id", (req, res) => {
    db.prepare("DELETE FROM media_items WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
