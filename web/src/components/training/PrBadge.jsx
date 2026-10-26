import { Trophy } from "lucide-react";

export function PrBadge() {
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
      style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
      title="Récord personal vigente"
    >
      <Trophy size={10} />
      PR
    </span>
  );
}
