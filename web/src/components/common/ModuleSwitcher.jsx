import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { MODULES } from "../../modules.js";

const EASE = [0.16, 1, 0.3, 1];

const menu = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: EASE, staggerChildren: 0.03, delayChildren: 0.02 } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease: "easeIn" } },
};
const item = {
  hidden: { opacity: 0, y: -4 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE } },
};

/**
 * Módulo actual con un menú para cambiar a otro; ocupa una sola fila aunque se sumen módulos.
 * Teclado: Enter/Espacio abre, flechas recorren, Escape cierra.
 */
export function ModuleSwitcher({ currentId }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const current = MODULES.find((m) => m.id === currentId) ?? MODULES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onMenuKey(e) {
    const items = [...rootRef.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Módulo: ${current.label}. Cambiar de módulo`}
        className="relative overflow-hidden w-full flex items-center gap-2.5 rounded-xl px-2 h-12 text-left transition-colors"
        style={{ border: "1px solid var(--border)", background: open ? "var(--surface-alt)" : "var(--surface)" }}
      >
        {/* Al cambiar de módulo, el ícono y el nombre se reemplazan con un desliz suave. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="flex items-center gap-2.5 flex-1 min-w-0"
          >
            <span className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
              <current.icon size={17} />
            </span>
            <span className="text-sm font-semibold truncate">{current.label}</span>
          </motion.span>
        </AnimatePresence>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="shrink-0 flex" style={{ color: "var(--text-faint)" }}>
          <ChevronDown size={15} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Cambiar de módulo"
            onKeyDown={onMenuKey}
            variants={menu}
            initial="hidden"
            animate="shown"
            exit="exit"
            onAnimationStart={() => rootRef.current?.querySelector('[role="menuitem"][aria-current="true"]')?.focus({ preventScroll: true })}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl p-1 origin-top"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
          >
            {MODULES.map((m) => {
              const active = m.id === current.id;
              return (
                <motion.div key={m.id} variants={item}>
                  <Link
                    to={m.basePath}
                    role="menuitem"
                    aria-current={active ? "true" : undefined}
                    onClick={() => setOpen(false)}
                    className="hover-surface flex items-center gap-2.5 px-2.5 h-10 text-sm"
                    style={{ color: active ? "var(--text)" : "var(--text-muted)", fontWeight: active ? 600 : 500 }}
                  >
                    <m.icon size={16} style={{ color: active ? "var(--accent)" : undefined }} />
                    <span className="flex-1">{m.label}</span>
                    {active && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
