import { LineTimelineChart } from "../common/LineTimelineChart.jsx";

export function MeasurementTimelineChart({ measurements, type }) {
  const data = measurements
    .filter((m) => m.type === type)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: new Date(m.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      value: m.value,
    }));

  return <LineTimelineChart data={data} unit=" cm" emptyMessage="Cargá al menos dos medidas de esta zona para ver el gráfico." />;
}
