import { db, nowIso } from "../db/index.js";

export default function registerBodyMeasurementsRoutes(app) {
  app.get("/api/body-measurements", (req, res) => {
    const { type } = req.query;
    const rows = type
      ? db.prepare("SELECT * FROM body_measurements WHERE type = ? ORDER BY date DESC").all(type)
      : db.prepare("SELECT * FROM body_measurements ORDER BY date DESC").all();
    res.json(rows);
  });

  app.post("/api/body-measurements", (req, res) => {
    const { type, value, date, notes } = req.body;
    if (!type || value === undefined || !date) {
      return res.status(400).json({ error: "type_value_date_required" });
    }
    const info = db
      .prepare("INSERT INTO body_measurements (type, value, date, notes, createdAt) VALUES (?, ?, ?, ?, ?)")
      .run(type, value, date, notes ?? null, nowIso());
    res.status(201).json(db.prepare("SELECT * FROM body_measurements WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/body-measurements/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM body_measurements WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const value = req.body.value ?? existing.value;
    const date = req.body.date ?? existing.date;
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
    db.prepare("UPDATE body_measurements SET value = ?, date = ?, notes = ? WHERE id = ?").run(
      value,
      date,
      notes,
      req.params.id
    );
    res.json(db.prepare("SELECT * FROM body_measurements WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/body-measurements/:id", (req, res) => {
    db.prepare("DELETE FROM body_measurements WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
