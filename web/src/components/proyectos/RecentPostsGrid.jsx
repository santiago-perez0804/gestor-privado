import { Heart, Images, MessageCircle } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { formatShortDate } from "../../lib/format.js";

const number = new Intl.NumberFormat("es-AR");

export function RecentPostsGrid({ media }) {
  return (
    <Card>
      <SectionHeading icon={Images}>Posts recientes</SectionHeading>
      {media.length === 0 ? (
        <EmptyState icon={Images}>Todavía no hay publicaciones.</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {media.map((m) => (
            <a
              key={m.id}
              href={m.permalink}
              target="_blank"
              rel="noreferrer"
              title={m.caption}
              className="block rounded-lg overflow-hidden"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
            >
              <div className="aspect-square" style={{ background: "var(--surface-alt)" }}>
                {m.imageUrl && <img src={m.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
              </div>
              <div className="px-1.5 py-1 flex items-center justify-between gap-1 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-0.5">
                  <Heart size={10} />
                  {number.format(m.likes)}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageCircle size={10} />
                  {number.format(m.comments)}
                </span>
                <span style={{ color: "var(--text-faint)" }}>{formatShortDate(m.timestamp.slice(0, 10))}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
