import { db, nowIso } from "../db/index.js";
import { generateDueRecurringExpenses } from "../services/recurringExpenses.js";

export default function registerExpensesRoutes(app) {
  app.get("/api/expenses", (req, res) => {
    generateDueRecurringExpenses();
    const rows = db.prepare("SELECT * FROM expenses ORDER BY date DESC, id DESC").all();
    res.json(rows);
  });

  app.post("/api/expenses", (req, res) => {
    const {
      title,
      description,
      amount,
      currency,
      originalAmount,
      exchangeRate,
      installments,
      date,
      icon,
      category,
      paymentMethod,
      merchantType,
    } = req.body;
    if (!title || amount === undefined || !date) {
      return res.status(400).json({ error: "title_amount_date_required" });
    }
    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO expenses
          (title, description, amount, currency, originalAmount, exchangeRate, installments, date, icon, category, paymentMethod, merchantType, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        description ?? null,
        amount,
        currency ?? "ARS",
        originalAmount ?? amount,
        exchangeRate ?? null,
        installments ?? 1,
        date,
        icon ?? null,
        category ?? null,
        paymentMethod ?? null,
        merchantType ?? null,
        ts,
        ts
      );
    res.status(201).json(db.prepare("SELECT * FROM expenses WHERE id = ?").get(info.lastInsertRowid));
  });

  // Importación (p. ej. desde el CSV del resumen de la tarjeta): todo o nada.
  app.post("/api/expenses/bulk", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items?.length) return res.status(400).json({ error: "items_required" });
    if (items.some((e) => !e.title || e.amount === undefined || !e.date)) {
      return res.status(400).json({ error: "title_amount_date_required" });
    }
    const insert = db.prepare(
      `INSERT INTO expenses
        (title, description, amount, currency, originalAmount, exchangeRate, installments, date, icon, category, paymentMethod, merchantType, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
    );
    const ids = [];
    db.exec("BEGIN");
    try {
      for (const e of items) {
        const ts = nowIso();
        const info = insert.run(
          e.title,
          e.description ?? null,
          e.amount,
          e.currency ?? "ARS",
          e.originalAmount ?? e.amount,
          e.exchangeRate ?? null,
          e.installments ?? 1,
          e.date,
          e.category ?? null,
          e.paymentMethod ?? "credito",
          e.merchantType ?? null,
          ts,
          ts
        );
        ids.push(info.lastInsertRowid);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    const rows = db.prepare(`SELECT * FROM expenses WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids);
    res.status(201).json(rows);
  });

  app.put("/api/expenses/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const merged = {
      title: req.body.title ?? existing.title,
      description: req.body.description !== undefined ? req.body.description : existing.description,
      amount: req.body.amount ?? existing.amount,
      currency: req.body.currency ?? existing.currency,
      originalAmount: req.body.originalAmount ?? existing.originalAmount,
      exchangeRate: req.body.exchangeRate !== undefined ? req.body.exchangeRate : existing.exchangeRate,
      installments: req.body.installments ?? existing.installments,
      date: req.body.date ?? existing.date,
      icon: req.body.icon !== undefined ? req.body.icon : existing.icon,
      category: req.body.category !== undefined ? req.body.category : existing.category,
      paymentMethod: req.body.paymentMethod !== undefined ? req.body.paymentMethod : existing.paymentMethod,
      merchantType: req.body.merchantType !== undefined ? req.body.merchantType : existing.merchantType,
    };
    db.prepare(
      `UPDATE expenses SET title=?, description=?, amount=?, currency=?, originalAmount=?, exchangeRate=?,
       installments=?, date=?, icon=?, category=?, paymentMethod=?, merchantType=?, updatedAt=? WHERE id=?`
    ).run(
      merged.title,
      merged.description,
      merged.amount,
      merged.currency,
      merged.originalAmount,
      merged.exchangeRate,
      merged.installments,
      merged.date,
      merged.icon,
      merged.category,
      merged.paymentMethod,
      merged.merchantType,
      nowIso(),
      req.params.id
    );
    res.json(db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id));
  });

  app.delete("/api/expenses/:id", (req, res) => {
    db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });
}
