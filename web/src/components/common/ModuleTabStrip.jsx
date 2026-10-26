import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MODULES } from "../../modules.js";

/**
 * Celular: las secciones de un módulo en una sola fila de pestañas que se desliza, con la activa
 * siempre a la vista. En escritorio no se muestra (están en la barra lateral).
 */
export function ModuleTabStrip({ moduleId }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const module = MODULES.find((m) => m.id === moduleId);
  const items = module.nav.flatMap((g) => g.items);

  useEffect(() => {
    const strip = ref.current;
    const active = strip?.querySelector('[aria-current="page"]');
    if (!strip || !active) return;
    const target = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [pathname]);

  return (
    <nav className="lg:hidden print:hidden sticky top-0 z-10 -mx-4 mb-4 px-4" style={{ background: "var(--bg)" }} aria-label={`Secciones de ${module.label}`}>
      <div ref={ref} className="no-scrollbar flex gap-5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex items-center gap-1.5 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 -mb-px"
            style={({ isActive }) => ({
              color: isActive ? "var(--accent-strong)" : "var(--text-faint)",
              borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
            })}
          >
            <item.icon size={14} style={item.color ? { color: item.color } : undefined} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
