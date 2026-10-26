import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";

const WIDTH = 288;

/**
 * Botón ⓘ con una ayuda corta. El panel se dibuja en un portal con posición fija: así no lo
 * recortan las columnas con scroll propio. `tip` = { title, lines[] }; `moreTo` = link a la guía.
 */
export function InfoTip({ tip, moreTo = "/gastos/tips#clasificar", label }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const r = buttonRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left - 12), window.innerWidth - WIDTH - 8);
    const below = r.bottom + 6;
    const panelHeight = panelRef.current?.offsetHeight ?? 0;
    const top = below + panelHeight > window.innerHeight - 8 ? Math.max(8, r.top - panelHeight - 6) : below;
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      {/* Área de toque de 24px sin mover el diseño (margen negativo). */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label || `Ayuda: ${tip.title}`}
        className="hover-surface inline-flex items-center justify-center !rounded-full shrink-0 -m-1"
        style={{ width: 24, height: 24, color: open ? "var(--accent-strong)" : "var(--text-faint)" }}
      >
        <Info size={12} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={tip.title}
            className="fixed z-50 rounded-xl p-3 text-xs"
            style={{
              width: WIDTH,
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
              color: "var(--text)",
            }}
          >
            <p className="font-semibold mb-1.5">{tip.title}</p>
            <ul className="space-y-1.5" style={{ color: "var(--text-muted)" }}>
              {tip.lines.map((line) => (
                <li key={line} className="leading-snug">
                  {line}
                </li>
              ))}
            </ul>
            {moreTo && (
              <Link to={moreTo} onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-1 font-semibold" style={{ color: "var(--accent-strong)" }}>
                Ver guía completa
                <ArrowRight size={12} />
              </Link>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
