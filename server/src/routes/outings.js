import { db, nowIso } from "../db/index.js";

export default function registerOutingsRoutes(app) {
  app.get("/api/outings", (req, res) => {
    const { status } = req.query;
    const rows = status
      ? db.prepare("SELECT * FROM outings WHERE status = ? ORDER BY plannedDate ASC").all(status)
      : db.prepare("SELECT * FROM outings ORDER BY plannedDate ASC").all();
    res.json(rows);
  });

  app.post("/api/outings", (req, res) => {
    const { title, plannedDate, category, location, notes, icon } = req.body;
    if (!title || !plannedDate) return res.status(400).json({ error: "title_plannedDate_required" });
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO outings (title, category, plannedDate, status, location, notes, icon, createdAt, updatedAt)
         VALUES (?, ?, ?, 'planeado', ?, ?, ?, ?, ?)`
      )
      .run(title, category ?? null, plannedDate, location ?? null, notes ?? null, icon ?? null, ts, ts);
    res.status(201).json(db.prepare("SELECT * FROM outings WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/outings/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM outings WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const merged = { ...existing };
    for (const key of ["title", "category", "plannedDate", "status", "location", "notes", "icon"]) {
      if (req.body[key] !== undefined) merged[key] = req.body[key];
    }
    db.prepare(
      `UPDATE outings SET title=?, category=?, plannedDate=?, status=?, location=?, notes=?, icon=?, updatedAt=? WHERE id=?`
    ).run(
      merged.title,
      merged.category,
      merged.plannedDate,
      merged.status,
      merged.location,
      merged.notes,
      merged.icon,
      nowIso(),
      req.params.id
    );
    res.json(db.prepare("SELECT * FROM outings WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/outings/:id", (req, res) => {
    db.prepare("DELETE FROM outings WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
