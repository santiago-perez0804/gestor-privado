import { get, post, put, del } from "./request.js";

export const gastosApi = {
  // expenses
  getExpenses: () => get("/expenses"),
  addExpense: (data) => post("/expenses", data),
  addExpensesBulk: (items) => post("/expenses/bulk", { items }),
  updateExpense: (id, data) => put(`/expenses/${id}`, data),
  deleteExpense: (id) => del(`/expenses/${id}`),

  // exchange rate
  // type: tarjeta | blue | bolsa (MEP) | oficial | cripto · side: venta | compra
  getExchangeRate: (type = "blue", side = "venta") => get(`/exchange-rate?type=${type}&side=${side}`),
  getExchangeRates: () => get("/exchange-rates"),

  // datos de mercado (inflación, plazo fijo, money market, billeteras)
  getMarket: () => get("/market"),

  // ingresos fijos
  getRecurringIncomes: () => get("/recurring-incomes"),
  addRecurringIncome: (data) => post("/recurring-incomes", data),
  updateRecurringIncome: (id, data) => put(`/recurring-incomes/${id}`, data),
  deleteRecurringIncome: (id) => del(`/recurring-incomes/${id}`),

  // cuentas y patrimonio
  getAccounts: () => get("/accounts"),
  getAccountSnapshots: () => get("/account-snapshots"),
  addAccount: (data) => post("/accounts", data),
  updateAccount: (id, data) => put(`/accounts/${id}`, data),
  deleteAccount: (id) => del(`/accounts/${id}`),

  // gastos recurrentes
  getRecurringExpenses: () => get("/recurring-expenses"),
  addRecurringExpense: (data) => post("/recurring-expenses", data),
  updateRecurringExpense: (id, data) => put(`/recurring-expenses/${id}`, data),
  deleteRecurringExpense: (id) => del(`/recurring-expenses/${id}`),

  // presupuestos
  getBudgets: () => get("/budgets"),
  setBudget: (category, monthlyLimit, rollover) => put(`/budgets/${category}`, { monthlyLimit, rollover }),
  deleteBudget: (category) => del(`/budgets/${category}`),

  // ingresos
  getIncomes: () => get("/incomes"),
  addIncome: (data) => post("/incomes", data),
  updateIncome: (id, data) => put(`/incomes/${id}`, data),
  deleteIncome: (id) => del(`/incomes/${id}`),

  // metas de ahorro
  getSavingsGoals: () => get("/savings-goals"),
  addSavingsGoal: (data) => post("/savings-goals", data),
  updateSavingsGoal: (id, data) => put(`/savings-goals/${id}`, data),
  deleteSavingsGoal: (id) => del(`/savings-goals/${id}`),
  addContribution: (goalId, data) => post(`/savings-goals/${goalId}/contributions`, data),
  deleteContribution: (id) => del(`/savings-contributions/${id}`),

  // deudas pendientes
  getDebts: () => get("/debts"),
  addDebt: (data) => post("/debts", data),
  updateDebt: (id, data) => put(`/debts/${id}`, data),
  payDebt: (id, amount) => post(`/debts/${id}/payments`, { amount }),
  deleteDebt: (id) => del(`/debts/${id}`),
};
