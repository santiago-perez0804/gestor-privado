import { db, nowIso } from "../db/index.js";
import { generateDueRecurringIncomes } from "../services/recurringExpenses.js";
import { INCOME_CATEGORIES } from "./incomes.js";

export default function registerRecurringIncomesRoutes(app) {
  app.get("/api/recurring-incomes", (req, res) => {
    res.json(db.prepare("SELECT * FROM recurring_incomes ORDER BY createdAt DESC").all());
  });

  app.post("/api/recurring-incomes", (req, res) => {
    const { title, amount, currency, category, dayOfMonth } = req.body;
    if (!title || !amount || !dayOfMonth) return res.status(400).json({ error: "title_amount_dayOfMonth_required" });
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO recurring_incomes (title, amount, currency, category, dayOfMonth, active, lastGeneratedBillingMonthKey, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?)`
      )
      .run(title, amount, currency === "USD" ? "USD" : "ARS", INCOME_CATEGORIES.includes(category) ? category : "sueldo", dayOfMonth, ts, ts);
    generateDueRecurringIncomes();
    res.status(201).json(db.prepare("SELECT * FROM recurring_incomes WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/recurring-incomes/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM recurring_incomes WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const m = {
      title: req.body.title ?? existing.title,
      amount: req.body.amount ?? existing.amount,
      currency: req.body.currency ?? existing.currency,
      category: INCOME_CATEGORIES.includes(req.body.category) ? req.body.category : existing.category,
      dayOfMonth: req.body.dayOfMonth ?? existing.dayOfMonth,
      active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active,
    };
    db.prepare(
      "UPDATE recurring_incomes SET title=?, amount=?, currency=?, category=?, dayOfMonth=?, active=?, updatedAt=? WHERE id=?"
    ).run(m.title, m.amount, m.currency, m.category, m.dayOfMonth, m.active, nowIso(), req.params.id);
    if (m.active) generateDueRecurringIncomes();
    res.json(db.prepare("SELECT * FROM recurring_incomes WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/recurring-incomes/:id", (req, res) => {
    db.prepare("DELETE FROM recurring_incomes WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
