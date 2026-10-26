import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/common/Card.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { EditButton } from "../../components/common/EditButton.jsx";
import { DeleteButton } from "../../components/common/DeleteButton.jsx";
import { getIconComponent } from "../../lib/icons.js";
import { PlanForm } from "../../components/training/PlanForm.jsx";
import { RoutinesList } from "../../components/training/RoutinesList.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

export function PlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const planApi = useApi(() => api.getPlan(planId), [planId]);
  const [editing, setEditing] = useState(false);

  async function handleAddRoutine(data) {
    await api.addRoutine(planId, data);
    planApi.reload();
  }

  async function handleUpdatePlan(data) {
    const updated = await api.updatePlan(planId, data);
    planApi.setData((prev) => ({ ...prev, ...updated }));
    setEditing(false);
  }

  async function handleDeletePlan() {
    await api.deletePlan(planId);
    navigate("/fisico");
  }

  if (!planApi.data) return null;
  const plan = planApi.data;
  const Icon = getIconComponent(plan.icon || "Dumbbell");

  return (
    <PageTransition>
      <PageHeader title={plan.name} subtitle={`${plan.routines.length} ${plan.routines.length === 1 ? "rutina" : "rutinas"}`} />
      <div className="flex flex-col gap-4">
        <Card>
          {editing ? (
            <PlanForm initial={plan} submitLabel="Guardar cambios" onSubmit={handleUpdatePlan} onCancel={() => setEditing(false)} />
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{plan.name}</p>
                {plan.description && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {plan.description}
                  </p>
                )}
              </div>
              <EditButton onClick={() => setEditing(true)} label="Editar plan" />
              <DeleteButton onClick={handleDeletePlan} label="Borrar plan" />
            </div>
          )}
        </Card>
        <RoutinesList routines={plan.routines} onAdd={handleAddRoutine} />
      </div>
    </PageTransition>
  );
}
