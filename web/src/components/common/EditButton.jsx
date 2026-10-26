import { Pencil, X } from "lucide-react";

export function EditButton({ editing, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-md p-1.5 transition-colors"
      style={{ color: editing ? "var(--accent-strong)" : "var(--text-faint)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--accent-strong)";
        e.currentTarget.style.background = "var(--accent-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = editing ? "var(--accent-strong)" : "var(--text-faint)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {editing ? <X size={15} /> : <Pencil size={15} />}
    </button>
  );
}
