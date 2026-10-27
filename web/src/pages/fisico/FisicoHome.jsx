import { Link } from "react-router-dom";
import { LineChart, Trophy, Ruler, Camera, ListChecks } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { WeightCurrentCard } from "../../components/training/WeightCurrentCard.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";

const PILLS = [
  { to: "/fisico/plan", label: "Plan y rutinas", icon: ListChecks },
  { to: "/fisico/peso", label: "Peso", icon: LineChart },
  { to: "/fisico/records", label: "Récords", icon: Trophy },
  { to: "/fisico/medidas", label: "Medidas", icon: Ruler },
  { to: "/fisico/fotos", label: "Fotos", icon: Camera },
];

export function FisicoHome() {
  const weightsApi = useApi(api.getWeights, []);
  const settingsApi = useApi(api.getSettings, []);

  async function handleAddWeight(data) {
    const created = await api.addWeight(data);
    weightsApi.setData((prev) => [created, ...(prev || [])]);
  }

  if (!weightsApi.data || !settingsApi.data) return null;

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-base font-semibold">Físico</h1>
        {/* En escritorio estas secciones ya están en la barra lateral. */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end lg:hidden">
          {PILLS.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5"
              style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
            >
              <p.icon size={13} />
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <WeightCurrentCard weights={weightsApi.data} goal={settingsApi.data.weight_goal_kg} onAdd={handleAddWeight} />
        <Link to="/fisico/plan" className="card-hover flex items-center gap-3 rounded-2xl p-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <ListChecks size={18} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold">Plan y rutinas</span>
        </Link>
      </div>
    </PageTransition>
  );
}
