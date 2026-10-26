import { Trash2 } from "lucide-react";

export function DeleteButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-md p-1.5 transition-colors"
      style={{ color: "var(--text-faint)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--danger)";
        e.currentTarget.style.background = "var(--danger-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-faint)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Trash2 size={15} />
    </button>
  );
}
