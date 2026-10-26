import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTHS_ES_ABBR } from "../../lib/billing.js";
import { currency } from "../../lib/format.js";

export function ExpenseProjectionChart({ items }) {
  const data = items.map((item, i) => ({
    label: `${MONTHS_ES_ABBR[item.billingMonth.month]} '${String(item.billingMonth.year).slice(2)}`,
    total: Math.round(item.total),
    isCurrent: i === 0,
  }));

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [currency.format(v), "Comprometido"]}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill="var(--accent)" fillOpacity={entry.isCurrent ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
