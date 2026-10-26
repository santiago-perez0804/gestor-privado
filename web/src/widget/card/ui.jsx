import { ArrowLeft } from "lucide-react";

export const STAT_STYLE = {
  health: { color: "#ef5b73", soft: "rgba(239, 91, 115, 0.14)" },
  hunger: { color: "#f59e0b", soft: "rgba(245, 158, 11, 0.14)" },
  energy: { color: "#6d7cff", soft: "rgba(109, 124, 255, 0.14)" },
  mood: { color: "#22b07d", soft: "rgba(34, 176, 125, 0.14)" },
};

export function ViewHeader({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        onClick={onBack}
        className="rounded-full p-1.5 -ml-1"
        style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}
        aria-label="Volver"
      >
        <ArrowLeft size={14} />
      </button>
      <h2 className="text-sm font-semibold flex-1">{title}</h2>
      {right}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="grid rounded-xl p-1 gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: "var(--surface-alt)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--accent-strong)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
            }}
          >
            {o.icon && <o.icon size={13} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick, type = "button", tone = "accent" }) {
  const bg = tone === "danger" ? "var(--danger)" : "var(--accent)";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-opacity"
      style={{ background: bg, color: "#fff", opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
      style={{
        background: active ? color || "var(--accent)" : "var(--surface-alt)",
        color: active ? "#fff" : "var(--text-muted)",
      }}
    >
      {children}
    </button>
  );
}

export const inputStyle = {
  background: "var(--surface-alt)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};
