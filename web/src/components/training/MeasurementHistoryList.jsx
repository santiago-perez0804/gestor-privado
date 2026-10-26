import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Ruler } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { inputClass } from "../common/FieldLabel.jsx";
import { MEASUREMENT_TYPE_LABELS } from "../../lib/icons.js";
import { formatShortDate } from "../../lib/format.js";

function EditRow({ item, onSave, onCancel }) {
  const [value, setValue] = useState(item.value);
  const [date, setDate] = useState(item.date);

  function submit(e) {
    e.preventDefault();
    onSave({ value: parseFloat(value), date });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <input type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass()} style={{ flex: 1 }} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass()} style={{ flex: 1.3 }} />
      <button type="submit" className="rounded-md p-1.5" style={{ color: "var(--accent-strong)" }} aria-label="Guardar">
        <Check size={16} />
      </button>
      <EditButton editing onClick={onCancel} label="Cancelar" />
    </form>
  );
}

export function MeasurementHistoryList({ measurements, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={Ruler}>Historial de medidas</SectionHeading>
      </div>
      {sorted.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Ruler}>Todavía no hay medidas registradas.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {sorted.map((m) =>
              editingId === m.id ? (
                <EditRow key={m.id} item={m} onSave={(data) => { onUpdate(m.id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              ) : (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{MEASUREMENT_TYPE_LABELS[m.type]}</p>
                    <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                      {formatShortDate(m.date)}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-medium tabular-nums shrink-0">{m.value} cm</p>
                  <EditButton onClick={() => setEditingId(m.id)} label="Editar" />
                  <DeleteButton onClick={() => onDelete(m.id)} label="Borrar" />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
