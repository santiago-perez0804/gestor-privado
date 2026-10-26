import { Camera } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { formatShortDate } from "../../lib/format.js";

export function PhotoGrid({ photos, onSelect }) {
  return (
    <Card>
      <SectionHeading icon={Camera}>Galería</SectionHeading>
      {photos.length === 0 ? (
        <EmptyState icon={Camera}>Todavía no subiste ninguna foto de progreso.</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="relative rounded-lg overflow-hidden aspect-square" style={{ border: "1px solid var(--border)" }}>
              <img src={`/photos/${p.fileName}`} alt={p.notes || p.date} className="w-full h-full object-cover" />
              <span
                className="absolute bottom-0 inset-x-0 text-[10px] font-mono text-center py-0.5"
                style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
              >
                {formatShortDate(p.date)}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
