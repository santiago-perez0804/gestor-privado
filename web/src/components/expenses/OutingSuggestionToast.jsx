import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CalendarDays, Check, X } from "lucide-react";
import { api } from "../../lib/api.js";
import { shortDay } from "../../lib/ocio/outings.js";

/**
 * Después de cargar un gasto: si hay una salida ese día (±1) o que el gasto menciona, pregunta si
 * va con ella. Es lo único que Ocio agrega a Finanzas, y no bloquea nada: se cierra solo.
 */
export function OutingSuggestionToast({ expense, onClose }) {
  const [outing, setOuting] = useState(null);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .suggestOutingsForExpense({ date: expense.date, title: expense.title, description: expense.description || "", expenseId: expense.id })
      .then((list) => alive && (list[0] ? setOuting(list[0]) : onClose()))
      .catch(() => alive && onClose());
    return () => {
      alive = false;
    };
  }, [expense, onClose]);

  useEffect(() => {
    if (!outing) return;
    const t = setTimeout(onClose, linked ? 2500 : 15000);
    return () => clearTimeout(t);
  }, [outing, linked, onClose]);

  if (!outing) return null;
  const day = shortDay(outing.date);
  return createPortal(
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed z-40 right-4 bottom-24 lg:bottom-6 w-[min(22rem,calc(100vw-2rem))] rounded-xl p-3.5 flex gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
        <CalendarDays size={17} />
      </span>
      <div className="min-w-0 flex-1">
        {linked ? (
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Check size={15} style={{ color: "var(--status-good)" }} />
            Vinculado a «{outing.title}»
          </p>
        ) : (
          <>
            <p className="text-sm">
              ¿«{expense.title}» va con <b>{outing.title}</b>?
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
              Salida del {day[0].toUpperCase() + day.slice(1)}
            </p>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={async () => {
                  await api.linkOutingExpense(outing.id, expense.id);
                  setLinked(true);
                }}
                className="h-8 px-3 rounded-lg text-xs font-semibold"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              >
                Vincular
              </button>
              <button onClick={onClose} className="hover-surface h-8 px-3 text-xs" style={{ border: "1px solid var(--border)" }}>
                No
              </button>
            </div>
          </>
        )}
      </div>
      <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-7 h-7 flex items-center justify-center shrink-0" style={{ color: "var(--text-faint)" }}>
        <X size={14} />
      </button>
    </motion.div>,
    document.body
  );
}
