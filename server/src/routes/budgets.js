import { db } from "../db/index.js";

export default function registerBudgetsRoutes(app) {
  app.get("/api/budgets", async (req, res) => {
    res.json(await db.prepare("SELECT * FROM budgets ORDER BY category ASC").all());
  });

  app.put("/api/budgets/:category", async (req, res) => {
    const { monthlyLimit } = req.body;
    if (monthlyLimit === undefined) return res.status(400).json({ error: "monthlyLimit_required" });
    const existing = await db.prepare("SELECT rollover FROM budgets WHERE category = ?").get(req.params.category);
    const rollover = req.body.rollover !== undefined ? (req.body.rollover ? 1 : 0) : existing?.rollover ?? 0;
    await db.prepare(
      `INSERT INTO budgets (category, monthlyLimit, rollover) VALUES (?, ?, ?)
       ON CONFLICT(category) DO UPDATE SET monthlyLimit = excluded.monthlyLimit, rollover = excluded.rollover`
    ).run(req.params.category, monthlyLimit, rollover);
    res.json(await db.prepare("SELECT * FROM budgets WHERE category = ?").get(req.params.category));
  });

  app.delete("/api/budgets/:category", async (req, res) => {
    await db.prepare("DELETE FROM budgets WHERE category = ?").run(req.params.category);
    res.status(204).end();
  });
}
