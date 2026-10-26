import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { openApp } from "../bridge.js";

export function PanelShell({ title, icon: Icon, route, onClose, onBack, loading, error, children }) {
  return (
    <div
      className="rounded-[22px] p-4 flex flex-col gap-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 18px 50px -18px rgba(0,0,0,0.45), var(--shadow-md)",
        color: "var(--text)",
      }}
    >
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-full p-1.5 -ml-1"
            style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}
            aria-label="Volver"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        <Icon size={16} style={{ color: "var(--accent)" }} />
        <h2 className="text-sm font-semibold flex-1">{title}</h2>
        <button onClick={onClose} className="rounded-full p-1" style={{ color: "var(--text-faint)" }} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          No pude traer los datos. ¿Está corriendo el server?
        </p>
      ) : loading ? (
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Cargando…
        </p>
      ) : (
        children
      )}

      <button
        onClick={() => openApp(route)}
        className="flex items-center justify-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 self-end"
        style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
      >
        Ver más
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

export function Stat({ label, value, hint, tone }) {
  const color = tone === "bad" ? "var(--danger)" : tone === "good" ? "var(--accent-strong)" : "var(--text)";
  return (
    <div className="min-w-0">
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="text-xl font-semibold font-mono leading-tight truncate" style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Row({ children, right }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex-1 truncate">{children}</span>
      {right != null && (
        <span className="font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
          {right}
        </span>
      )}
    </div>
  );
}

export function Bar({ ratio }) {
  const pct = Math.min(1, Math.max(0, ratio)) * 100;
  const color = ratio >= 1 ? "var(--status-critical)" : ratio >= 0.85 ? "var(--status-warning)" : "var(--accent)";
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function daysSince(dateStr) {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((today - d) / 86400000);
}
