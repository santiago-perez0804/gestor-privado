function ensureColumn(db, table, column, ddlType) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
}

export function runMigrations(db) {
  ensureColumn(db, "expenses", "category", "TEXT");
  ensureColumn(
    db,
    "expenses",
    "recurringExpenseId",
    "INTEGER REFERENCES recurring_expenses(id) ON DELETE SET NULL"
  );
  ensureColumn(db, "expenses", "paymentMethod", "TEXT CHECK(paymentMethod IN ('credito','debito'))");
  // Presupuesto con arrastre: lo que sobra (o falta) del período anterior se suma al actual.
  ensureColumn(db, "budgets", "rollover", "INTEGER NOT NULL DEFAULT 0");
  // Tipo de comercio (súper, kiosco, comer afuera…): para comparar dónde comprás entre meses.
  ensureColumn(db, "expenses", "merchantType", "TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_expenses_recurringExpenseId ON expenses(recurringExpenseId)");
}
