import { useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EXPENSE_CATEGORIES } from "../../lib/expenseCategories.js";
import { currency } from "../../lib/format.js";
import { BudgetEditRow } from "./BudgetEditRow.jsx";

function statusColor(ratio) {
  if (ratio > 1) return "var(--status-critical)";
  if (ratio >= 0.8) return "var(--status-warning)";
  return "var(--status-good)";
}

export function BudgetProgressList({ budgets, totalsByCategory, onSave }) {
  const [editingCategory, setEditingCategory] = useState(null);
  // `budgets` ya viene con el arrastre aplicado (effectiveBudgets): limit = tope + carry.
  const budgetByCategory = Object.fromEntries(budgets.map((b) => [b.category, b]));

  return (
    <Card>
      <SectionHeading icon={Wallet}>Presupuestos por categoría</SectionHeading>
      <div className="space-y-3">
        {EXPENSE_CATEGORIES.map((c) => {
          const budget = budgetByCategory[c.id];
          const limit = budget?.limit;
          const spent = totalsByCategory[c.id] || 0;

          if (editingCategory === c.id) {
            return (
              <BudgetEditRow
                key={c.id}
                categoryId={c.id}
                currentLimit={budget?.monthlyLimit}
                currentRollover={budget?.rollover}
                onSave={(value, rollover) => {
                  onSave(c.id, value, rollover);
                  setEditingCategory(null);
                }}
                onCancel={() => setEditingCategory(null)}
              />
            );
          }

          if (!budget) {
            return (
              <button
                key={c.id}
                onClick={() => setEditingCategory(c.id)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm" style={{ color: "var(--text-faint)" }}>
                  {c.label}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--accent-strong)" }}>
                  Definir presupuesto
                </span>
              </button>
            );
          }

          const ratio = limit > 0 ? spent / limit : spent > 0 ? 2 : 0;
          const color = statusColor(ratio);

          return (
            <button key={c.id} onClick={() => setEditingCategory(c.id)} className="w-full text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm flex items-center gap-1">
                  {c.label}
                  {ratio > 1 && <AlertTriangle size={12} style={{ color: "var(--status-critical)" }} />}
                </span>
                <span className="text-xs font-mono tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {currency.format(spent)} / {currency.format(limit)}
                </span>
              </div>
              {budget.rollover && budget.carry !== 0 ? (
                <p className="text-[10px] mb-1" style={{ color: budget.carry > 0 ? "var(--status-good)" : "var(--status-warning)" }}>
                  {budget.carry > 0 ? `+${currency.format(budget.carry)} que sobraron` : `${currency.format(budget.carry)} que te pasaste`} el período anterior
                </p>
              ) : null}
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "var(--surface-alt)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(ratio, 1) * 100}%`, background: color, transition: "width 0.3s" }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
