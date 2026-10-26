import { MEDIA_TYPE_LABELS } from "../../lib/icons.js";

export function MediaTypeFilter({ value, onChange }) {
  const options = [{ id: "", label: "Todos" }, ...Object.entries(MEDIA_TYPE_LABELS).map(([id, label]) => ({ id, label }))];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id || "todos"}
            onClick={() => onChange(opt.id)}
            className="text-xs font-semibold rounded-full px-3 py-1.5"
            style={{
              color: active ? "#fff" : "var(--text-muted)",
              background: active ? "var(--accent)" : "var(--surface-alt)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
