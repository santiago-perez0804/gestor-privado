import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Barra de título de una página a todo el ancho (escritorio): ruta chica arriba ("Ocio · Agenda"),
 * título y acciones a la derecha. En celular queda como un encabezado simple.
 */
export function PageBar({ crumb, title, back = false, children }) {
  const navigate = useNavigate();
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 lg:mb-0 lg:px-7 lg:py-4 lg:border-b">
      {back && (
        <button onClick={() => navigate(-1)} aria-label="Volver" className="hover-surface flex items-center justify-center w-9 h-9 shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <ArrowLeft size={16} />
        </button>
      )}
      <div className="min-w-0 mr-auto">
        {crumb && (
          <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
            {crumb}
          </p>
        )}
        {title && <h1 className="text-lg lg:text-xl font-semibold leading-tight truncate">{title}</h1>}
      </div>
      {children}
    </header>
  );
}
