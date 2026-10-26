import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { RecurringExpenseForm } from "../../components/expenses/RecurringExpenseForm.jsx";
import { RecurringExpenseList } from "../../components/expenses/RecurringExpenseList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function Recurrentes() {
  const recurringApi = useApi(api.getRecurringExpenses, []);

  async function handleAdd(data) {
    const created = await api.addRecurringExpense(data);
    recurringApi.setData((prev) => [created, ...(prev || [])]);
  }

  async function handleToggleActive(id, active) {
    const updated = await api.updateRecurringExpense(id, { active });
    recurringApi.setData((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function handleDelete(id) {
    await api.deleteRecurringExpense(id);
    recurringApi.setData((prev) => prev.filter((r) => r.id !== id));
  }

  if (!recurringApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Gastos recurrentes" subtitle="Suscripciones y pagos fijos" />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <RecurringExpenseForm onAdd={handleAdd} />
        <RecurringExpenseList items={recurringApi.data} onToggleActive={handleToggleActive} onDelete={handleDelete} />
      </div>
    </PageTransition>
  );
}
