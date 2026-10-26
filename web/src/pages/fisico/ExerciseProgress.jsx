import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { getIconComponent, pickExerciseIcon } from "../../lib/icons.js";
import { ExerciseProgressChart } from "../../components/training/ExerciseProgressChart.jsx";
import { ExerciseLogHistoryList } from "../../components/training/ExerciseLogHistoryList.jsx";
import { QuickLogForm } from "../../components/training/QuickLogForm.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function ExerciseProgress() {
  const { exerciseLibraryId } = useParams();
  const exerciseApi = useApi(() => api.getExercise(exerciseLibraryId), [exerciseLibraryId]);
  const logsApi = useApi(() => api.getExerciseLogs({ exerciseLibraryId }), [exerciseLibraryId]);
  const recordApi = useApi(() => api.getExerciseRecords({ exerciseLibraryId }), [exerciseLibraryId]);
  const [logging, setLogging] = useState(false);

  async function handleAddLog(data) {
    const created = await api.addExerciseLog({ exerciseLibraryId, ...data });
    logsApi.setData((prev) => [created, ...(prev || [])]);
    recordApi.reload();
    setLogging(false);
  }

  async function handleUpdateLog(id, data) {
    const updated = await api.updateExerciseLog(id, data);
    logsApi.setData((prev) => prev.map((l) => (l.id === id ? updated : l)));
    recordApi.reload();
  }

  async function handleDeleteLog(id) {
    await api.deleteExerciseLog(id);
    logsApi.setData((prev) => prev.filter((l) => l.id !== id));
    recordApi.reload();
  }

  if (!exerciseApi.data || !logsApi.data) return null;
  const exercise = exerciseApi.data;
  const Icon = getIconComponent(pickExerciseIcon(exercise.primaryMuscles));

  return (
    <PageTransition>
      <PageHeader title={exercise.name} subtitle={exercise.primaryMuscles.join(", ")} />
      <div className="flex flex-col gap-4">
        <Card>
          <SectionHeading icon={Icon}>Progreso</SectionHeading>
          <ExerciseProgressChart logs={logsApi.data} />
        </Card>

        {logging ? (
          <QuickLogForm onSubmit={handleAddLog} onCancel={() => setLogging(false)} />
        ) : (
          <button
            onClick={() => setLogging(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
          >
            <Plus size={16} />
            Registrar sesión de hoy
          </button>
        )}

        <ExerciseLogHistoryList
          logs={logsApi.data}
          onUpdate={handleUpdateLog}
          onDelete={handleDeleteLog}
          recordLogId={recordApi.data?.id}
        />
      </div>
    </PageTransition>
  );
}
