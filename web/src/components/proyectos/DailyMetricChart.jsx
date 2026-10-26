import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "../common/EmptyState.jsx";

const number = new Intl.NumberFormat("es-AR");

/** data: [{ date: label, value }]. Una sola métrica por gráfico (sin doble eje). */
export function DailyMetricChart({ data, label }) {
  if (!data.length) {
    return <EmptyState icon={BarChart3}>Todavía no hay datos de {label.toLowerCase()}.</EmptyState>;
  }
  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }} barCategoryGap={2}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-alt)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--text-muted)" }}
            formatter={(v) => [number.format(v), label]}
          />
          <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
