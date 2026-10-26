import { db } from "../db/index.js";

export default function registerSettingsRoutes(app) {
  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  });

  app.put("/api/settings/:key", (req, res) => {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value_required" });
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(req.params.key, String(value));
    res.json({ key: req.params.key, value: String(value) });
  });

  app.delete("/api/settings/:key", (req, res) => {
    db.prepare("DELETE FROM settings WHERE key = ?").run(req.params.key);
    res.status(204).end();
  });
}
