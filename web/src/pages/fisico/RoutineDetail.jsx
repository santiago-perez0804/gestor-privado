import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { EditButton } from "../../components/common/EditButton.jsx";
import { DeleteButton } from "../../components/common/DeleteButton.jsx";
import { getIconComponent } from "../../lib/icons.js";
import { RoutineForm } from "../../components/training/RoutineForm.jsx";
import { RoutineExerciseForm } from "../../components/training/RoutineExerciseForm.jsx";
import { RoutineExerciseList } from "../../components/training/RoutineExerciseList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function RoutineDetail() {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const routineApi = useApi(() => api.getRoutine(routineId), [routineId]);
  const [editing, setEditing] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);

  async function handleUpdateRoutine(data) {
    const updated = await api.updateRoutine(routineId, data);
    routineApi.setData((prev) => ({ ...prev, ...updated }));
    setEditing(false);
  }

  async function handleDeleteRoutine() {
    await api.deleteRoutine(routineId);
    navigate(-1);
  }

  async function handleAddExercise(data) {
    await api.addRoutineExercise(routineId, data);
    setAddingExercise(false);
    routineApi.reload();
  }

  async function handleUpdateExercise(id, data) {
    await api.updateRoutineExercise(id, data);
    routineApi.reload();
  }

  async function handleDeleteExercise(id) {
    await api.deleteRoutineExercise(id);
    routineApi.setData((prev) => ({ ...prev, exercises: prev.exercises.filter((e) => e.id !== id) }));
  }

  async function handleLog(exerciseLibraryId, data) {
    await api.addExerciseLog({ exerciseLibraryId, routineId: Number(routineId), ...data });
  }

  if (!routineApi.data) return null;
  const routine = routineApi.data;
  const Icon = getIconComponent(routine.icon || "Dumbbell");

  return (
    <PageTransition>
      <PageHeader title={routine.name} subtitle={`${routine.exercises.length} ${routine.exercises.length === 1 ? "ejercicio" : "ejercicios"}`} />
      <div className="flex flex-col gap-4">
        <Card>
          {editing ? (
            <RoutineForm initial={routine} submitLabel="Guardar cambios" onSubmit={handleUpdateRoutine} onCancel={() => setEditing(false)} />
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{routine.name}</p>
                {routine.description && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {routine.description}
                  </p>
                )}
              </div>
              <EditButton onClick={() => setEditing(true)} label="Editar rutina" />
              <DeleteButton onClick={handleDeleteRoutine} label="Borrar rutina" />
            </div>
          )}
        </Card>

        {addingExercise ? (
          <RoutineExerciseForm onSubmit={handleAddExercise} onCancel={() => setAddingExercise(false)} />
        ) : (
          <button
            onClick={() => setAddingExercise(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
          >
            <Plus size={16} />
            Agregar ejercicio
          </button>
        )}

        <RoutineExerciseList exercises={routine.exercises} onUpdate={handleUpdateExercise} onDelete={handleDeleteExercise} onLog={handleLog} />
      </div>
    </PageTransition>
  );
}
