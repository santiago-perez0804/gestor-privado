import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../common/EmptyState.jsx";
import { LineChart as LineChartIcon } from "lucide-react";

function MiniChart({ data, dataKey, label, unit }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div style={{ width: "100%", height: 140 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-faint)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${v}${unit}`, label]}
            />
            <Line type="monotone" dataKey={dataKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ExerciseProgressChart({ logs }) {
  if (logs.length < 2) {
    return <EmptyState icon={LineChartIcon}>Registrá al menos dos sesiones para ver el progreso.</EmptyState>;
  }

  const data = [...logs]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((l) => ({
      date: new Date(l.recordedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      weight: l.weight,
      reps: l.reps,
    }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <MiniChart data={data} dataKey="weight" label="Peso levantado" unit="kg" />
      <MiniChart data={data} dataKey="reps" label="Repeticiones" unit="" />
    </div>
  );
}
