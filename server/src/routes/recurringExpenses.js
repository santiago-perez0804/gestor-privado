import { db, nowIso } from "../db/index.js";
import { generateDueRecurringExpenses } from "../services/recurringExpenses.js";

export default function registerRecurringExpensesRoutes(app) {
  app.get("/api/recurring-expenses", async (req, res) => {
    res.json(await db.prepare("SELECT * FROM recurring_expenses ORDER BY createdAt DESC").all());
  });

  app.post("/api/recurring-expenses", async (req, res) => {
    const { title, description, amount, currency, category, icon, dayOfMonth } = req.body;
    if (!title || !amount || !dayOfMonth) {
      return res.status(400).json({ error: "title_amount_dayOfMonth_required" });
    }
    const ts = nowIso();
    const info = await db
      .prepare(
        `INSERT INTO recurring_expenses
          (title, description, amount, currency, category, icon, dayOfMonth, active, lastGeneratedBillingMonthKey, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`
      )
      .run(title, description ?? null, amount, currency ?? "ARS", category ?? null, icon ?? null, dayOfMonth, ts, ts);
    await generateDueRecurringExpenses();
    res.status(201).json(await db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/recurring-expenses/:id", async (req, res) => {
    const existing = await db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const merged = {
      title: req.body.title ?? existing.title,
      description: req.body.description !== undefined ? req.body.description : existing.description,
      amount: req.body.amount ?? existing.amount,
      currency: req.body.currency ?? existing.currency,
      category: req.body.category !== undefined ? req.body.category : existing.category,
      icon: req.body.icon !== undefined ? req.body.icon : existing.icon,
      dayOfMonth: req.body.dayOfMonth ?? existing.dayOfMonth,
      active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active,
    };
    await db.prepare(
      `UPDATE recurring_expenses SET title=?, description=?, amount=?, currency=?, category=?, icon=?,
       dayOfMonth=?, active=?, updatedAt=? WHERE id=?`
    ).run(
      merged.title,
      merged.description,
      merged.amount,
      merged.currency,
      merged.category,
      merged.icon,
      merged.dayOfMonth,
      merged.active,
      nowIso(),
      req.params.id
    );
    if (merged.active) await generateDueRecurringExpenses();
    res.json(await db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/recurring-expenses/:id", async (req, res) => {
    await db.prepare("DELETE FROM recurring_expenses WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
