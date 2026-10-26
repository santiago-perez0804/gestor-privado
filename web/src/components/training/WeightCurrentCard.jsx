import { Scale, TrendingDown, TrendingUp, Target } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { WeightQuickForm } from "./WeightQuickForm.jsx";

export function WeightCurrentCard({ weights, goal, onAdd }) {
  const sorted = [...weights].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const current = sorted.at(-1);
  const previous = sorted.at(-2);
  const delta = current && previous ? +(current.weight - previous.weight).toFixed(1) : 0;
  const goalNum = goal ? parseFloat(goal) : null;
  const goalDelta = current && goalNum ? +(current.weight - goalNum).toFixed(1) : null;

  return (
    <Card>
      <SectionHeading icon={Scale}>Peso corporal</SectionHeading>
      {current ? (
        <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-4xl font-semibold tabular-nums" style={{ letterSpacing: "-0.02em" }}>
              {current.weight}
            </span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              kg
            </span>
          </div>
          <div className="flex items-center gap-2">
            {previous && (
              <span
                className="flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1"
                style={{
                  color: delta <= 0 ? "var(--accent-strong)" : "var(--danger)",
                  background: delta <= 0 ? "var(--accent-soft)" : "var(--danger-soft)",
                }}
              >
                {delta <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {Math.abs(delta)} kg
              </span>
            )}
            {goalDelta !== null && (
              <span
                className="flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1"
                style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}
              >
                <Target size={13} />
                {goalDelta === 0
                  ? "¡Meta alcanzada!"
                  : `${Math.abs(goalDelta)} kg ${goalDelta > 0 ? "por encima" : "por debajo"} de tu meta`}
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm mb-4" style={{ color: "var(--text-faint)" }}>
          Todavía no cargaste ningún peso.
        </p>
      )}
      <WeightQuickForm onAdd={onAdd} />
    </Card>
  );
}
