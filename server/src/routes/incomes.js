import { db, nowIso } from "../db/index.js";
import { generateDueRecurringIncomes } from "../services/recurringExpenses.js";

export const INCOME_CATEGORIES = ["sueldo", "freelance", "extra", "inversion", "otros"];

export default function registerIncomesRoutes(app) {
  app.get("/api/incomes", async (req, res) => {
    await generateDueRecurringIncomes();
    res.json(await db.prepare("SELECT * FROM incomes ORDER BY date DESC, id DESC").all());
  });

  app.post("/api/incomes", async (req, res) => {
    const { title, amount, currency, originalAmount, exchangeRate, category, date, notes } = req.body;
    if (!title || amount === undefined || !date) {
      return res.status(400).json({ error: "title_amount_date_required" });
    }
    const ts = nowIso();
    const info = await db
      .prepare(
        `INSERT INTO incomes (title, amount, currency, originalAmount, exchangeRate, category, date, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        amount,
        currency ?? "ARS",
        originalAmount ?? amount,
        exchangeRate ?? null,
        INCOME_CATEGORIES.includes(category) ? category : "otros",
        date,
        notes ?? null,
        ts,
        ts
      );
    res.status(201).json(await db.prepare("SELECT * FROM incomes WHERE id = ?").get(info.lastInsertRowid));
  });

  app.put("/api/incomes/:id", async (req, res) => {
    const existing = await db.prepare("SELECT * FROM incomes WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const merged = {
      title: req.body.title ?? existing.title,
      amount: req.body.amount ?? existing.amount,
      currency: req.body.currency ?? existing.currency,
      originalAmount: req.body.originalAmount ?? existing.originalAmount,
      exchangeRate: req.body.exchangeRate !== undefined ? req.body.exchangeRate : existing.exchangeRate,
      category: INCOME_CATEGORIES.includes(req.body.category) ? req.body.category : existing.category,
      date: req.body.date ?? existing.date,
      notes: req.body.notes !== undefined ? req.body.notes : existing.notes,
    };
    await db.prepare(
      `UPDATE incomes SET title=?, amount=?, currency=?, originalAmount=?, exchangeRate=?, category=?, date=?, notes=?, updatedAt=?
       WHERE id=?`
    ).run(
      merged.title,
      merged.amount,
      merged.currency,
      merged.originalAmount,
      merged.exchangeRate,
      merged.category,
      merged.date,
      merged.notes,
      nowIso(),
      req.params.id
    );
    res.json(await db.prepare("SELECT * FROM incomes WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/incomes/:id", async (req, res) => {
    await db.prepare("DELETE FROM incomes WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
