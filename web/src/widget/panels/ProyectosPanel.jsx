import { FolderKanban, AlertTriangle } from "lucide-react";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { PanelShell } from "./PanelShell.jsx";

const number = new Intl.NumberFormat("es-AR");
const COLUMNS = { gridTemplateColumns: "1fr auto auto", gap: "0 12px" };

function Delta({ value }) {
  if (value == null) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const color = value > 0 ? "var(--accent-strong)" : value < 0 ? "var(--danger)" : "var(--text-faint)";
  return (
    <span style={{ color }}>
      {value > 0 ? "+" : ""}
      {number.format(value)}
    </span>
  );
}

export function ProyectosPanel({ onClose, onBack }) {
  const { data, loading, error } = useApi(api.getProjects, []);

  return (
    <PanelShell title="Proyectos" icon={FolderKanban} route="/proyectos" onClose={onClose} onBack={onBack} loading={loading} error={error}>
      {data &&
        (data.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Todavía no cargaste proyectos.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid text-[11px]" style={{ ...COLUMNS, color: "var(--text-faint)" }}>
              <span>Proyecto</span>
              <span className="text-right">Seguidores</span>
              <span className="text-right">7 días</span>
            </div>
            {data.map((p) => (
              <div key={p.id} className="grid items-center text-xs" style={COLUMNS}>
                <span className="truncate flex items-center gap-1">
                  {p.lastSyncError && <AlertTriangle size={12} style={{ color: "var(--status-warning)" }} />}
                  {p.name}
                </span>
                <span className="font-mono text-right">{p.latest?.followers != null ? number.format(p.latest.followers) : "—"}</span>
                <span className="font-mono text-right">
                  <Delta value={p.delta7} />
                </span>
              </div>
            ))}
          </div>
        ))}
    </PanelShell>
  );
}
