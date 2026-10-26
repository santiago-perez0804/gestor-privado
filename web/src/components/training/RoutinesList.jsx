import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Dumbbell, Plus } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { getIconComponent } from "../../lib/icons.js";
import { RoutineForm } from "./RoutineForm.jsx";

export function RoutinesList({ routines, onAdd }) {
  const [addingOpen, setAddingOpen] = useState(false);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading
          icon={Dumbbell}
          action={
            !addingOpen && (
              <button
                onClick={() => setAddingOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1"
                style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
              >
                <Plus size={12} />
                Nueva rutina
              </button>
            )
          }
        >
          Rutinas
        </SectionHeading>
      </div>

      {addingOpen && (
        <div className="px-5 pb-4">
          <RoutineForm
            onSubmit={(data) => {
              onAdd(data);
              setAddingOpen(false);
            }}
            onCancel={() => setAddingOpen(false)}
          />
        </div>
      )}

      {routines.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Dumbbell}>Este plan todavía no tiene rutinas.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {routines.map((routine) => {
            const Icon = getIconComponent(routine.icon || "Dumbbell");
            return (
              <Link
                key={routine.id}
                to={`/fisico/rutina/${routine.id}`}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 34, height: 34, background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{routine.name}</p>
                  {routine.description && (
                    <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
                      {routine.description}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-faint)" }} className="shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
