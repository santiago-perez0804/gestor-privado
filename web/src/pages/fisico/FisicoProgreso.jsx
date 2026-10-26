import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { WeightTimelineChart } from "../../components/training/WeightTimelineChart.jsx";
import { WeightGoalEditor } from "../../components/training/WeightGoalEditor.jsx";
import { WeightHistoryList } from "../../components/training/WeightHistoryList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { Target } from "lucide-react";

export function FisicoProgreso() {
  const weightsApi = useApi(api.getWeights, []);
  const settingsApi = useApi(api.getSettings, []);

  async function handleSaveGoal(value) {
    await api.setSetting("weight_goal_kg", value);
    settingsApi.setData((prev) => ({ ...prev, weight_goal_kg: value }));
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateWeight(id, data);
    weightsApi.setData((prev) => prev.map((w) => (w.id === id ? updated : w)));
  }

  async function handleDelete(id) {
    await api.deleteWeight(id);
    weightsApi.setData((prev) => prev.filter((w) => w.id !== id));
  }

  if (!weightsApi.data || !settingsApi.data) return null;

  return (
    <PageTransition>
      <PageHeader title="Progreso de peso" />
      <div className="flex flex-col gap-4">
        <Card>
          <SectionHeading icon={Target}>Meta</SectionHeading>
          <WeightGoalEditor goal={settingsApi.data.weight_goal_kg} onSave={handleSaveGoal} />
        </Card>
        <Card>
          <SectionHeading>Timeline</SectionHeading>
          <WeightTimelineChart weights={weightsApi.data} goal={settingsApi.data.weight_goal_kg} />
        </Card>
        <WeightHistoryList weights={weightsApi.data} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
    </PageTransition>
  );
}
