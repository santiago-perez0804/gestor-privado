import { useState } from "react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { inputClass } from "../../components/common/FieldLabel.jsx";
import { MeasurementQuickForm } from "../../components/training/MeasurementQuickForm.jsx";
import { MeasurementHistoryList } from "../../components/training/MeasurementHistoryList.jsx";
import { MeasurementTimelineChart } from "../../components/training/MeasurementTimelineChart.jsx";
import { MEASUREMENT_TYPE_LABELS } from "../../lib/icons.js";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { Ruler } from "lucide-react";

export function Medidas() {
  const measurementsApi = useApi(api.getMeasurements, []);
  const [chartType, setChartType] = useState("cintura");

  async function handleAdd(data) {
    const created = await api.addMeasurement(data);
    measurementsApi.setData((prev) => [created, ...(prev || [])]);
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateMeasurement(id, data);
    measurementsApi.setData((prev) => prev.map((m) => (m.id === id ? updated : m)));
  }

  async function handleDelete(id) {
    await api.deleteMeasurement(id);
    measurementsApi.setData((prev) => prev.filter((m) => m.id !== id));
  }

  if (!measurementsApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Medidas corporales" />
      <div className="flex flex-col gap-4">
        <Card>
          <SectionHeading
            icon={Ruler}
            action={
              <select value={chartType} onChange={(e) => setChartType(e.target.value)} className={inputClass()} style={{ width: "auto" }}>
                {Object.entries(MEASUREMENT_TYPE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            }
          >
            Timeline
          </SectionHeading>
          <MeasurementTimelineChart measurements={measurementsApi.data} type={chartType} />
        </Card>
        <MeasurementQuickForm onAdd={handleAdd} />
        <MeasurementHistoryList measurements={measurementsApi.data} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
    </PageTransition>
  );
}
