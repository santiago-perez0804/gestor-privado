import { billingMonthLabel } from "../../lib/billing.js";
import { currency } from "../../lib/format.js";

export function ExpenseProjectionTable({ items }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            borderBottom: i === items.length - 1 ? "none" : "1px solid var(--border)",
            background: i === 0 ? "var(--accent-soft)" : "transparent",
          }}
        >
          <span className="text-sm capitalize" style={{ color: i === 0 ? "var(--accent-strong)" : "var(--text)" }}>
            {billingMonthLabel(item.billingMonth)}
            {i === 0 && <span className="text-xs font-medium ml-1.5">(actual)</span>}
          </span>
          <span className="font-mono text-sm tabular-nums font-medium">{currency.format(item.total)}</span>
        </div>
      ))}
    </div>
  );
}
