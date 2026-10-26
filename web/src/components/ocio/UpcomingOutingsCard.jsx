import { Link } from "react-router-dom";
import { MapPin, ChevronRight } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { getIconComponent, OUTING_ICON } from "../../lib/icons.js";
import { formatShortDate, todayDateInputValue } from "../../lib/format.js";

export function UpcomingOutingsCard({ outings }) {
  const today = todayDateInputValue();
  const upcoming = outings
    .filter((o) => o.plannedDate >= today && o.status === "planeado")
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    .slice(0, 3);

  return (
    <Card>
      <SectionHeading
        icon={MapPin}
        action={
          <Link to="/ocio/salidas" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--accent-strong)" }}>
            Ver todas
            <ChevronRight size={13} />
          </Link>
        }
      >
        Próximas salidas
      </SectionHeading>
      {upcoming.length === 0 ? (
        <EmptyState icon={MapPin}>No tenés salidas planeadas.</EmptyState>
      ) : (
        <div className="space-y-2">
          {upcoming.map((o) => {
            const Icon = getIconComponent(o.icon || OUTING_ICON);
            return (
              <div key={o.id} className="flex items-center gap-3">
                <Icon size={14} style={{ color: "var(--accent)" }} className="shrink-0" />
                <p className="text-sm flex-1 truncate">{o.title}</p>
                <p className="text-xs font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                  {formatShortDate(o.plannedDate)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
