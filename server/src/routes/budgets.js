import { db } from "../db/index.js";

export default function registerBudgetsRoutes(app) {
  app.get("/api/budgets", (req, res) => {
    res.json(db.prepare("SELECT * FROM budgets ORDER BY category ASC").all());
  });

  app.put("/api/budgets/:category", (req, res) => {
    const { monthlyLimit } = req.body;
    if (monthlyLimit === undefined) return res.status(400).json({ error: "monthlyLimit_required" });
    const existing = db.prepare("SELECT rollover FROM budgets WHERE category = ?").get(req.params.category);
    const rollover = req.body.rollover !== undefined ? (req.body.rollover ? 1 : 0) : existing?.rollover ?? 0;
    db.prepare(
      `INSERT INTO budgets (category, monthlyLimit, rollover) VALUES (?, ?, ?)
       ON CONFLICT(category) DO UPDATE SET monthlyLimit = excluded.monthlyLimit, rollover = excluded.rollover`
    ).run(req.params.category, monthlyLimit, rollover);
    res.json(db.prepare("SELECT * FROM budgets WHERE category = ?").get(req.params.category));
  });

  app.delete("/api/budgets/:category", (req, res) => {
    db.prepare("DELETE FROM budgets WHERE category = ?").run(req.params.category);
    res.status(204).end();
  });
}
