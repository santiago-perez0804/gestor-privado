import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { getIconComponent, MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS } from "../../lib/icons.js";

export function OcioSummaryCard({ items }) {
  const byType = {};
  for (const item of items) {
    if (item.status !== "en_progreso") continue;
    if (!byType[item.type] || item.updatedAt > byType[item.type].updatedAt) byType[item.type] = item;
  }
  const types = Object.keys(MEDIA_TYPE_LABELS);

  return (
    <Card>
      <SectionHeading icon={Sparkles}>En progreso ahora</SectionHeading>
      <div className="space-y-2">
        {types.map((type) => {
          const item = byType[type];
          const Icon = getIconComponent(item?.icon || MEDIA_TYPE_ICONS[type]);
          return (
            <Link
              key={type}
              to={`/ocio/medios?type=${type}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5"
              style={{ background: item ? "var(--accent-soft)" : "transparent" }}
            >
              <Icon size={15} style={{ color: item ? "var(--accent-strong)" : "var(--text-faint)" }} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {MEDIA_TYPE_LABELS[type]}
                </p>
                <p className="text-sm truncate" style={{ color: item ? "var(--text)" : "var(--text-faint)" }}>
                  {item ? item.title : "Nada en progreso"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
