import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { CategoryDistributionChart } from "../../components/expenses/CategoryDistributionChart.jsx";
import { BudgetProgressList } from "../../components/expenses/BudgetProgressList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getBillingMonth, CUTOFF_DAY, monthlyTotalByCategory, billingMonthLabel } from "../../lib/billing.js";
import { todayDateInputValue } from "../../lib/format.js";
import { effectiveBudgets } from "../../lib/finance.js";
import { PieChart } from "lucide-react";

export function Reportes() {
  const expensesApi = useApi(api.getExpenses, []);
  const budgetsApi = useApi(api.getBudgets, []);

  async function handleSaveBudget(category, monthlyLimit, rollover) {
    const updated = await api.setBudget(category, monthlyLimit, rollover);
    budgetsApi.setData((prev) => [...(prev || []).filter((b) => b.category !== category), updated]);
  }

  if (!expensesApi.data || !budgetsApi.data) return null;

  const currentBillingMonth = getBillingMonth(todayDateInputValue(), CUTOFF_DAY);
  const totalsByCategory = monthlyTotalByCategory(expensesApi.data, currentBillingMonth);

  return (
    <PageTransition>
      <PageHeader title="Reportes de gastos" subtitle={billingMonthLabel(currentBillingMonth)} />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <SectionHeading icon={PieChart}>Distribución por categoría</SectionHeading>
          <CategoryDistributionChart totalsByCategory={totalsByCategory} />
        </Card>
        <BudgetProgressList
          budgets={effectiveBudgets(budgetsApi.data, expensesApi.data, currentBillingMonth)}
          totalsByCategory={totalsByCategory}
          onSave={handleSaveBudget}
        />
      </div>
    </PageTransition>
  );
}
