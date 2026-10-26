import { DollarSign } from "lucide-react";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import {
  getBillingMonth,
  billingPeriodProgress,
  monthlyTotal,
  monthlyTotalByCategory,
  billingMonthAdd,
  MONTHS_ES,
} from "../../lib/billing.js";
import { categoryLabel } from "../../lib/expenseCategories.js";
import { currency, todayDateInputValue } from "../../lib/format.js";
import { monthlyIncome, spendingLimitFromSettings, spendingLimitStatus, effectiveBudgets } from "../../lib/finance.js";
import { installmentPlans } from "../../lib/installments.js";
import { PanelShell, Stat, Row, Bar } from "./PanelShell.jsx";

export function GastosPanel({ onClose, onBack }) {
  const { data, loading, error } = useApi(() => Promise.all([api.getExpenses(), api.getBudgets(), api.getIncomes(), api.getSettings()]), []);

  let body = null;
  if (data) {
    const [expenses, budgets, incomes, settings] = data;
    const today = todayDateInputValue();
    const bm = getBillingMonth(today);
    const total = monthlyTotal(expenses, bm);
    const prevTotal = monthlyTotal(expenses, billingMonthAdd(bm, -1));
    const progress = billingPeriodProgress(bm, today);
    const byCategory = monthlyTotalByCategory(expenses, bm);
    const budgetRows = effectiveBudgets(budgets, expenses, bm)
      .map((b) => ({ ...b, spent: byCategory[b.category] || 0 }))
      .sort((a, b) => b.spent / (b.limit || 1) - a.spent / (a.limit || 1))
      .slice(0, 4);
    const income = monthlyIncome(incomes, bm);
    const limit = spendingLimitFromSettings(settings);
    const limitStatus = spendingLimitStatus(total, limit, progress);
    const activePlans = installmentPlans(expenses, today).filter((p) => !p.done && p.remaining > 0);
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    body = (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={`Período de ${MONTHS_ES[bm.month]}`} value={currency.format(total)} hint={`anterior: ${currency.format(prevTotal)}`} />
          <Stat label="Cierre en" value={`${progress.daysLeft} días`} hint={`día ${progress.dayNumber} de ${progress.totalDays}`} />
        </div>
        <div className="flex flex-col gap-1">
          <Row right={`${currency.format(total)} / ${currency.format(limit)}`}>Meta de no gasto</Row>
          <Bar ratio={limitStatus.ratio} />
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {limitStatus.status === "over"
              ? `Te pasaste por ${currency.format(-limitStatus.remaining)}`
              : `Quedan ${currency.format(limitStatus.remaining)} · ${currency.format(limitStatus.perDay)}/día`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {income > 0 && (
            <Row right={`${currency.format(income - total)} (${Math.round(((income - total) / income) * 100)}%)`}>
              {income - total >= 0 ? "Ahorro del período" : "Déficit del período"}
            </Row>
          )}
          {activePlans.length > 0 && (
            <Row right={currency.format(activePlans.reduce((s, p) => s + p.remainingAmount, 0))}>
              {activePlans.length} compras en cuotas · resta
            </Row>
          )}
        </div>
        {budgetRows.length > 0 ? (
          <div className="flex flex-col gap-2">
            {budgetRows.map((b) => (
              <div key={b.category} className="flex flex-col gap-1">
                <Row right={`${currency.format(b.spent)} / ${currency.format(b.limit)}`}>{categoryLabel(b.category)}</Row>
                <Bar ratio={b.limit > 0 ? b.spent / b.limit : 1} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {topCategories.map(([cat, amount]) => (
              <Row key={cat} right={currency.format(amount)}>
                {categoryLabel(cat)}
              </Row>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <PanelShell title="Gastos" icon={DollarSign} route="/gastos" onClose={onClose} onBack={onBack} loading={loading} error={error}>
      {body}
    </PanelShell>
  );
}
