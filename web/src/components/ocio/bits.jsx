// Piezas chicas de Ocio que se repiten en varias pantallas.
import { Link } from "react-router-dom";
import { WORK_TYPES, progressRatio, progressText, statusLabel } from "../../lib/ocio/types.js";

/** "• LIBRO" en el color del tipo. */
export function TypeLabel({ type, className = "" }) {
  const t = WORK_TYPES[type];
  if (!t) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${className}`} style={{ color: t.color }}>
      <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: t.color }} />
      {t.label}
    </span>
  );
}

/** Barra fina de progreso en el color del tipo. */
export function ProgressBar({ ratio, type, className = "" }) {
  return (
    <div className={`rounded-full overflow-hidden ${className}`} style={{ height: 4, background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.round((ratio ?? 0) * 100)}%`, background: WORK_TYPES[type]?.color ?? "var(--accent)" }} />
    </div>
  );
}

/** Texto + barra del progreso de la pasada actual (o nada si no hay datos). */
export function ItemProgress({ item, compact = false }) {
  const progress = item.currentPass?.progress;
  const text = progressText(progress, item.type);
  const ratio = progressRatio(progress);
  if (!text && ratio == null) return null;
  return (
    <div className={compact ? "mt-1.5" : "mt-2"}>
      <ProgressBar ratio={ratio ?? 0} type={item.type} />
      <div className="flex items-center justify-between gap-2 mt-1 text-[11px] font-mono" style={{ color: "var(--text-faint)" }}>
        <span className="truncate">{text}</span>
        {ratio != null && !compact && <span>{Math.round(ratio * 100)}%</span>}
      </div>
    </div>
  );
}

/** Pastilla "Quiero leer" / "Viendo" / etc. */
export function StatusPill({ item }) {
  return (
    <span className="inline-block text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
      {statusLabel(item.type, item.status)}
    </span>
  );
}

// Genéricos de sección: viven en common (los usan Ocio y Físico).
export { Panel, SectionTitle } from "../common/Section.jsx";
