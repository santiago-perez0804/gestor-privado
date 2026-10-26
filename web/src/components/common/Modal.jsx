import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

/**
 * Ventana modal: se dibuja sobre todo (portal), cierra con Escape o tocando afuera, bloquea el
 * scroll de la página y devuelve el foco a donde estaba al cerrarse.
 */
export function Modal({ onClose, labelledBy, children, className = "", width = "56rem" }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco inicial: el primer campo del modal (o el modal mismo).
    const first = panelRef.current?.querySelector("input, textarea, select, button");
    (first || panelRef.current)?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto" style={{ background: "rgba(5,8,7,.62)" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full rounded-2xl outline-none ${className}`}
        style={{ maxWidth: width, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 30px 80px -30px rgba(0,0,0,.7)" }}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  );
}
