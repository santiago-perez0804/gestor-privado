import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { getIconComponent } from "../../lib/icons.js";

/** `compact`: botón chico sin borde, pensado para ir dentro de un campo de texto (el menú abre hacia la izquierda). */
export function IconPicker({ value, autoIconName, options, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const displayedIconName = value || autoIconName;
  const DisplayIcon = getIconComponent(displayedIconName);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Elegir ícono"
        title="Ícono del gasto (automático según el título)"
        className="flex items-center justify-center rounded-lg shrink-0"
        style={
          compact
            ? { width: 28, height: 28, color: value ? "var(--accent-strong)" : "var(--text-faint)", background: value ? "var(--accent-soft)" : "transparent" }
            : { width: 38, height: 38, background: "var(--accent-soft)", color: "var(--accent-strong)", border: "1px solid var(--border)" }
        }
      >
        <DisplayIcon size={compact ? 15 : 17} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ duration: 0.14 }}
            className={`absolute z-20 ${compact ? "right-0" : "left-0"} top-[calc(100%+6px)] rounded-xl p-2`}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", width: 216 }}
          >
            <div className="grid grid-cols-6 gap-1">
              {options.map((name) => {
                const OptIcon = getIconComponent(name);
                const selected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onChange(name);
                      setOpen(false);
                    }}
                    aria-label={name}
                    className="flex items-center justify-center rounded-lg p-1.5"
                    style={{
                      background: selected ? "var(--accent)" : "transparent",
                      color: selected ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    <OptIcon size={15} />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 mt-2 text-xs font-medium"
              style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}
            >
              <RotateCcw size={12} />
              Automático
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
