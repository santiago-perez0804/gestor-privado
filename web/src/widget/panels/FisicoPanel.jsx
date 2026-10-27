import { User } from "lucide-react";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { PanelShell, Stat, Row, daysSince } from "./PanelShell.jsx";

export function FisicoPanel({ onClose, onBack }) {
  const { data, loading, error } = useApi(
    () => Promise.all([api.getWeights(), api.getSettings(), api.getSessions().catch(() => []), api.getPlans()]),
    []
  );

  let body = null;
  if (data) {
    const [weights, settings, sessions, plans] = data;
    const sorted = [...weights].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const current = sorted.at(-1);
    const previous = sorted.at(-2);
    const delta = current && previous ? +(current.weight - previous.weight).toFixed(1) : null;
    const goal = settings.weight_goal_kg ? parseFloat(settings.weight_goal_kg) : null;
    const toGoal = current && goal ? +(current.weight - goal).toFixed(1) : null;
    const last = sessions[0];
    const trainedAgo = last ? daysSince(last.startedAt) : null;
    const todaySets = sessions.filter((s) => daysSince(s.startedAt) === 0).reduce((n, s) => n + (s.workingSets || 0), 0);

    body = (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Peso actual"
            value={current ? `${current.weight} kg` : "—"}
            hint={delta != null ? `${delta > 0 ? "+" : ""}${delta} kg vs anterior` : null}
            tone={delta == null ? null : delta <= 0 ? "good" : "bad"}
          />
          <Stat
            label="Objetivo"
            value={goal ? `${goal} kg` : "—"}
            hint={toGoal != null ? (toGoal === 0 ? "¡Llegaste!" : `faltan ${Math.abs(toGoal)} kg`) : "sin definir"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Row right={trainedAgo == null ? "nunca" : trainedAgo === 0 ? "hoy" : `hace ${trainedAgo} d`}>Último entrenamiento</Row>
          <Row right={todaySets}>Series de trabajo hoy</Row>
          <Row right={plans.length}>Planes de entrenamiento</Row>
        </div>
      </>
    );
  }

  return (
    <PanelShell title="Físico" icon={User} route="/fisico" onClose={onClose} onBack={onBack} loading={loading} error={error}>
      {body}
    </PanelShell>
  );
}
