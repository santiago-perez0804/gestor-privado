import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const MENU_ITEM_PX = 40;

/**
 * Menú de acciones (⋮): se dibuja fuera de la página (portal, posición fija), así ningún contenedor
 * con overflow lo recorta; abre hacia arriba si abajo no entra. Se cierra al tocar afuera, con
 * Escape o al scrollear.
 */
export function ActionsMenu({ items, label: aria = "Acciones" }) {
  const [pos, setPos] = useState(null); // { top|bottom, right } cuando está abierto
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const list = items.filter(Boolean);
  const open = !!pos;

  function toggle() {
    if (open) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    const height = list.length * MENU_ITEM_PX + 12;
    const right = Math.max(8, window.innerWidth - r.right);
    const below = window.innerHeight - r.bottom;
    setPos(below >= height + 8 || below >= r.top ? { top: r.bottom + 4, right } : { bottom: window.innerHeight - r.top + 4, right });
  }

  useEffect(() => {
    if (!open) return;
    const close = (e) => !btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target) && setPos(null);
    const esc = (e) => e.key === "Escape" && setPos(null);
    const away = () => setPos(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);
  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle} aria-label={aria} aria-expanded={open} className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
        <div ref={menuRef} role="menu" className="fixed z-50 min-w-44 rounded-xl py-1.5" style={{ ...pos, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 16px 40px -16px rgba(0,0,0,.5)" }}>
          {list.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => (setPos(null), it.onClick())}
              className="hover-surface w-full text-left px-3.5 h-10 text-sm flex items-center gap-2 disabled:opacity-40"
              style={{ color: it.danger ? "var(--danger)" : "var(--text)", borderRadius: 0 }}
            >
              {it.icon && <it.icon size={15} />}
              {it.label}
            </button>
          ))}
        </div>,
          document.body
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
