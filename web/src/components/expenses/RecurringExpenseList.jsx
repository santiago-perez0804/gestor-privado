import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Repeat, Power } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { getIconComponent, pickExpenseIcon } from "../../lib/icons.js";
import { categoryLabel } from "../../lib/expenseCategories.js";
import { currency } from "../../lib/format.js";
import { billingMonthLabel } from "../../lib/billing.js";

function parseBillingMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return { year, month: month - 1 };
}

export function RecurringExpenseList({ items, onToggleActive, onDelete }) {
  const [busyId, setBusyId] = useState(null);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={Repeat}>Recurrentes</SectionHeading>
      </div>
      {items.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Repeat}>Todavía no hay gastos recurrentes.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const Icon = getIconComponent(item.icon || pickExpenseIcon(item.title));
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: "1px solid var(--border)", opacity: item.active ? 1 : 0.5 }}
                >
                  <span
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: 34, height: 34, background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Día {item.dayOfMonth}
                      {item.category ? ` · ${categoryLabel(item.category)}` : ""}
                      {item.lastGeneratedBillingMonthKey
                        ? ` · última generación: ${billingMonthLabel(parseBillingMonthKey(item.lastGeneratedBillingMonthKey))}`
                        : " · sin generar todavía"}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-medium tabular-nums shrink-0">
                    {item.currency === "USD" ? `US$ ${item.amount}` : currency.format(item.amount)}
                  </p>
                  <button
                    onClick={async () => {
                      setBusyId(item.id);
                      await onToggleActive(item.id, !item.active);
                      setBusyId(null);
                    }}
                    disabled={busyId === item.id}
                    aria-label={item.active ? "Pausar" : "Activar"}
                    className="shrink-0 rounded-md p-1.5"
                    style={{ color: item.active ? "var(--accent-strong)" : "var(--text-faint)" }}
                  >
                    <Power size={15} />
                  </button>
                  <DeleteButton onClick={() => onDelete(item.id)} label="Borrar recurrente" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
