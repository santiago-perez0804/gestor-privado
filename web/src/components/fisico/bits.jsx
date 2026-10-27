import { useEffect, useRef, useState } from "react";
import { MoreVertical, Star } from "lucide-react";
import { muscleLabel } from "../../lib/fisico/labels.js";
import { num } from "../../lib/fisico/index.js";

export const field = "w-full h-10 rounded-lg px-3 text-sm min-w-0";
export const label = "block text-xs mb-1.5";

/** Chip de músculo con su cantidad de series ("Bíceps ★ 12,5"). */
export function MuscleChip({ muscle, value, priority }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap"
      style={priority ? { background: "color-mix(in srgb, var(--status-warning) 16%, transparent)", color: "var(--text)" } : { background: "var(--surface-alt)", color: "var(--text-muted)" }}
    >
      {muscleLabel(muscle)}
      {priority && <Star size={11} fill="currentColor" style={{ color: "var(--status-warning)" }} />}
      {value != null && <span className="font-mono">{num(value)}</span>}
    </span>
  );
}

/** Menú de acciones (⋮): se cierra al tocar afuera o con Escape. */
export function ActionsMenu({ items, label: aria = "Acciones" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={aria} aria-expanded={open} className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-20 min-w-44 rounded-xl py-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 16px 40px -16px rgba(0,0,0,.5)" }}>
          {items.filter(Boolean).map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => (setOpen(false), it.onClick())}
              className="hover-surface w-full text-left px-3.5 h-10 text-sm flex items-center gap-2 disabled:opacity-40"
              style={{ color: it.danger ? "var(--danger)" : "var(--text)", borderRadius: 0 }}
            >
              {it.icon && <it.icon size={15} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Celda de dato grande con rótulo (cabecera del plan). */
export function StatCell({ label: title, value, sub, children, className = "" }) {
  return (
    <div className={`min-w-0 p-4 lg:px-7 lg:py-5 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] ${className}`}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <p className="text-[15px] font-semibold mt-1 truncate">{value}</p>
      {children}
      {sub && (
        <p className="text-xs mt-1 truncate" style={{ color: "var(--text-faint)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
