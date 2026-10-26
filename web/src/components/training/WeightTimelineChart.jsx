import { LineTimelineChart } from "../common/LineTimelineChart.jsx";

export function WeightTimelineChart({ weights, goal }) {
  const data = [...weights]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((w) => ({
      date: new Date(w.recordedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      value: w.weight,
    }));

  return (
    <LineTimelineChart
      data={data}
      unit=" kg"
      referenceValue={goal ? parseFloat(goal) : null}
      referenceLabel="Objetivo"
      emptyMessage="Cargá al menos dos pesos para ver el gráfico de progreso."
    />
  );
}
