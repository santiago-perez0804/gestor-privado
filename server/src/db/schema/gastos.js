export const gastosSchema = `
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  category TEXT,
  icon TEXT,
  dayOfMonth INTEGER NOT NULL CHECK(dayOfMonth BETWEEN 1 AND 28),
  active INTEGER NOT NULL DEFAULT 1,
  lastGeneratedBillingMonthKey TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  originalAmount REAL NOT NULL,
  exchangeRate REAL,
  installments INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  icon TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  category TEXT PRIMARY KEY,
  monthlyLimit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  originalAmount REAL NOT NULL,
  exchangeRate REAL,
  category TEXT NOT NULL DEFAULT 'sueldo',
  date TEXT NOT NULL,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  targetAmount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  deadline TEXT,
  icon TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goalId INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  category TEXT NOT NULL DEFAULT 'sueldo',
  dayOfMonth INTEGER NOT NULL CHECK(dayOfMonth BETWEEN 1 AND 28),
  active INTEGER NOT NULL DEFAULT 1,
  lastGeneratedBillingMonthKey TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Cuentas: dónde está la plata (efectivo, banco, billetera, inversiones). El saldo se actualiza a mano.
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'banco' CHECK(type IN ('efectivo','banco','billetera','inversion','otro')),
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  balance REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Un registro por cuenta y día cada vez que cambia el saldo: alimenta la evolución del patrimonio.
CREATE TABLE IF NOT EXISTS account_snapshots (
  accountId INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  balance REAL NOT NULL,
  PRIMARY KEY (accountId, date)
);

-- Deudas pendientes: lo que debo ('debo') o lo que me deben ('me_deben'). paidAmount acumula pagos parciales.
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  person TEXT,
  direction TEXT NOT NULL DEFAULT 'debo' CHECK(direction IN ('debo','me_deben')),
  amount REAL NOT NULL,
  paidAmount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency IN ('ARS','USD')),
  dueDate TEXT,
  notes TEXT,
  settledAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_goalId ON savings_contributions(goalId);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(active);
`;
