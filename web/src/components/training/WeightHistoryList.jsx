import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Scale, Check } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { inputClass } from "../common/FieldLabel.jsx";
import { formatDateTime, toLocalDateTimeInputValue } from "../../lib/format.js";

function EditRow({ entry, onSave, onCancel }) {
  const [weight, setWeight] = useState(entry.weight);
  const [recordedAt, setRecordedAt] = useState(toLocalDateTimeInputValue(entry.recordedAt));

  function submit(e) {
    e.preventDefault();
    onSave({ weight: parseFloat(weight), recordedAt });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass()} style={{ flex: 1 }} />
      <input type="datetime-local" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} className={inputClass()} style={{ flex: 1.3 }} />
      <button type="submit" className="rounded-md p-1.5" style={{ color: "var(--accent-strong)" }} aria-label="Guardar">
        <Check size={16} />
      </button>
      <EditButton editing onClick={onCancel} label="Cancelar" />
    </form>
  );
}

export function WeightHistoryList({ weights, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const sorted = [...weights].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={Scale}>Historial de peso</SectionHeading>
      </div>
      {sorted.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Scale}>Todavía no hay registros de peso.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {sorted.map((w) =>
              editingId === w.id ? (
                <EditRow
                  key={w.id}
                  entry={w}
                  onSave={(data) => {
                    onUpdate(w.id, data);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p className="font-mono text-sm font-semibold tabular-nums flex-1">{w.weight} kg</p>
                  <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                    {formatDateTime(w.recordedAt)}
                  </p>
                  <EditButton onClick={() => setEditingId(w.id)} label="Editar" />
                  <DeleteButton onClick={() => onDelete(w.id)} label="Borrar" />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
