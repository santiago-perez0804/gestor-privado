import { NavLink } from "react-router-dom";
import { MODULES } from "../../modules.js";

export function BottomNav({ className = "" }) {
  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-10 print:hidden ${className}`}
      style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
    >
      <div className="max-w-md mx-auto grid" style={{ gridTemplateColumns: `repeat(${MODULES.length}, 1fr)` }}>
        {MODULES.map((m) => (
          <NavLink
            key={m.id}
            to={m.basePath}
            className="flex flex-col items-center gap-1 py-2.5"
            style={({ isActive }) => ({ color: isActive ? "var(--accent)" : "var(--text-faint)" })}
          >
            {({ isActive }) => (
              <>
                <m.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[11px] font-medium">{m.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
