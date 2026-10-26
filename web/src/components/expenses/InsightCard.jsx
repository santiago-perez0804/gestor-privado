import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { getIconComponent } from "../../lib/icons.js";
import { TONE_STYLE } from "../../lib/insights.js";

/** Un tip del motor de insights: ícono + etiqueta de estado (nunca solo color), título y detalle. */
export function InsightCard({ insight, compact = false }) {
  const tone = TONE_STYLE[insight.tone];
  const Icon = getIconComponent(insight.icon, "Lightbulb");
  return (
    <div className="flex gap-3 rounded-xl p-3" style={{ background: tone.bg }}>
      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 30, height: 30, background: "var(--surface)", color: tone.fg }}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: tone.fg }}>
            {tone.label}
          </span>
        </div>
        <p className="text-sm font-semibold leading-snug">{insight.title}</p>
        {!compact && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {insight.body}
          </p>
        )}
        {insight.action && !compact && (
          <Link to={insight.action.to} className="ghost-action inline-flex items-center gap-0.5 text-xs font-semibold mt-1 px-2 py-1 -mx-2" style={{ color: "var(--accent-strong)" }}>
            {insight.action.label}
            <ChevronRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}
