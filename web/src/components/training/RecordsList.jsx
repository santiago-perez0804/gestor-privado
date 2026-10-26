import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { getIconComponent, pickExerciseIcon } from "../../lib/icons.js";
import { formatShortDate } from "../../lib/format.js";

export function RecordsList({ records }) {
  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={Trophy}>Récords personales</SectionHeading>
      </div>
      {records.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Trophy}>Todavía no hay récords — registrá sesiones con peso en tus ejercicios.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {records.map((r) => {
            const Icon = getIconComponent(pickExerciseIcon(r.primaryMuscles));
            return (
              <Link
                key={r.exerciseLibraryId}
                to={`/fisico/ejercicio/${r.exerciseLibraryId}`}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Icon size={16} style={{ color: "var(--accent)" }} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.exerciseName}</p>
                  <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                    {r.weight}kg × {r.sets}×{r.reps} · {formatShortDate(r.recordedAt.slice(0, 10))}
                  </p>
                </div>
                <p className="font-mono text-sm font-medium tabular-nums shrink-0" style={{ color: "var(--accent-strong)" }}>
                  1RM ~{Math.round(r.estOneRm)}kg
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
