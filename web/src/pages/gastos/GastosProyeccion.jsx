import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { ExpenseProjectionChart } from "../../components/expenses/ExpenseProjectionChart.jsx";
import { ExpenseProjectionTable } from "../../components/expenses/ExpenseProjectionTable.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { getBillingMonth, CUTOFF_DAY, projection } from "../../lib/billing.js";
import { todayDateInputValue } from "../../lib/format.js";
import { TrendingUp } from "lucide-react";

export function GastosProyeccion() {
  const expensesApi = useApi(api.getExpenses, []);
  if (!expensesApi.data) return null;

  const currentBillingMonth = getBillingMonth(todayDateInputValue(), CUTOFF_DAY);
  const items = projection(expensesApi.data, currentBillingMonth, 6);

  return (
    <PageTransition>
      <PageHeader title="Proyección de gastos" subtitle="Cuotas ya comprometidas" />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <SectionHeading icon={TrendingUp}>Próximos meses</SectionHeading>
          <ExpenseProjectionChart items={items} />
          <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
            Muestra lo que ya está comprometido por cuotas en curso — no incluye compras futuras que todavía no cargaste.
          </p>
        </Card>
        <ExpenseProjectionTable items={items} />
      </div>
    </PageTransition>
  );
}
