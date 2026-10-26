import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { getIconComponent } from "../../../lib/icons.js";
import { TONE_STYLE } from "../../../lib/insights.js";

export const DISMISSED_ALERTS_SETTING_KEY = "dismissed_alerts";
const MAX_DISMISSED = 60;

/** Avisos descartados: "id|YYYY-MM" (vuelven a aparecer en otro período si siguen aplicando). */
export function parseDismissed(settings) {
  try {
    const list = JSON.parse(settings?.[DISMISSED_ALERTS_SETTING_KEY] || "[]");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function withDismissed(set, alertId, periodKey) {
  return [...set, `${alertId}|${periodKey}`].slice(-MAX_DISMISSED);
}

/** El aviso más importante del período (solo tonos de alerta) y cuántos más hay. */
export function AlertBanner({ alerts, onDismiss }) {
  if (!alerts.length) return null;
  const [alert, ...rest] = alerts;
  const tone = TONE_STYLE[alert.tone] ?? TONE_STYLE.warn;
  const Icon = getIconComponent(alert.icon, "AlertTriangle");
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl px-4 py-3 lg:mx-7 lg:mt-5"
      style={{ background: `color-mix(in srgb, ${tone.fg} 8%, var(--surface))`, border: `1px solid color-mix(in srgb, ${tone.fg} 28%, transparent)` }}
    >
      <span className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, background: `color-mix(in srgb, ${tone.fg} 16%, transparent)`, color: tone.fg }}>
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <b style={{ color: tone.fg }}>{alert.title}.</b> {alert.body}
        </p>
        {rest.length > 0 && (
          <Link to="/gastos/analisis" className="ghost-action inline-block text-xs mt-1 px-2 py-1 -mx-2" style={{ color: "var(--text-faint)" }}>
            +{rest.length} {rest.length === 1 ? "aviso más" : "avisos más"} en Análisis
          </Link>
        )}
      </div>
      {alert.action && (
        <Link to={alert.action.to} className="ghost-action flex items-center h-8 px-3 text-xs font-semibold whitespace-nowrap shrink-0" style={{ color: tone.fg, border: `1px solid color-mix(in srgb, ${tone.fg} 35%, transparent)` }}>
          {alert.action.label}
        </Link>
      )}
      <button onClick={() => onDismiss(alert.id)} className="hover-surface flex items-center justify-center w-8 h-8 shrink-0" style={{ color: "var(--text-faint)" }} aria-label="Descartar este aviso" title="Descartar (vuelve el próximo período si sigue aplicando)">
        <X size={15} />
      </button>
    </div>
  );
}
