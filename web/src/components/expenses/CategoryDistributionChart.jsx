import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../common/EmptyState.jsx";
import { PieChart as PieChartIcon } from "lucide-react";
import { EXPENSE_CATEGORIES } from "../../lib/expenseCategories.js";
import { currency } from "../../lib/format.js";

export function CategoryDistributionChart({ totalsByCategory }) {
  const data = EXPENSE_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    total: Math.round(totalsByCategory[c.id] || 0),
    colorVar: c.colorVar,
  })).filter((d) => d.total > 0);

  if (data.length === 0) {
    return <EmptyState icon={PieChartIcon}>Todavía no hay gastos con categoría este mes.</EmptyState>;
  }

  return (
    <div style={{ width: "100%", height: Math.max(140, data.length * 34) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [currency.format(v), ""]}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.id} fill={`var(${d.colorVar})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
