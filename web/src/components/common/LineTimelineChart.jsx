import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "./EmptyState.jsx";
import { LineChart as LineChartIcon } from "lucide-react";

/**
 * Gráfico de línea genérico reutilizado por peso corporal y medidas.
 * data: [{ date: string(label), value: number }], ya ordenado.
 */
export function LineTimelineChart({ data, unit = "", referenceValue = null, referenceLabel = "Objetivo", emptyMessage }) {
  if (!data.length) {
    return <EmptyState icon={LineChartIcon}>{emptyMessage || "Cargá al menos dos registros para ver el gráfico."}</EmptyState>;
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--text-faint)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 1", "dataMax + 1"]}
            tick={{ fontSize: 10, fill: "var(--text-faint)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            formatter={(v) => [`${v}${unit}`, ""]}
          />
          {referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke="var(--text-faint)"
              strokeDasharray="4 4"
              label={{ value: referenceLabel, fontSize: 10, fill: "var(--text-faint)", position: "insideTopLeft" }}
            />
          )}
          <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
