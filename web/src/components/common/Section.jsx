import { Link } from "react-router-dom";

/** Título de sección con acción opcional a la derecha ("Ver biblioteca"). */
export function SectionTitle({ children, count, action, to }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-[15px] font-semibold">
        {children}
        {count != null && (
          <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-faint)" }}>
            {count}
          </span>
        )}
      </h2>
      {to ? (
        <Link to={to} className="ghost-action text-xs font-semibold px-2 py-1 -mr-2 whitespace-nowrap" style={{ color: "var(--accent-strong)" }}>
          {action}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

/** Contenedor de sección: plano con bordes en escritorio, card en celular. */
export function Panel({ children, className = "" }) {
  return <section className={`p-4 sm:p-5 lg:px-7 lg:py-6 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] ${className}`}>{children}</section>;
}
