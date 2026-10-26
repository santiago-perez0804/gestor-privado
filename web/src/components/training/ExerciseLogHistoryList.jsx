import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Check } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { inputClass } from "../common/FieldLabel.jsx";
import { PrBadge } from "./PrBadge.jsx";
import { formatDateTime } from "../../lib/format.js";

function EditRow({ log, onSave, onCancel }) {
  const [weight, setWeight] = useState(log.weight ?? "");
  const [sets, setSets] = useState(log.sets);
  const [reps, setReps] = useState(log.reps);

  function submit(e) {
    e.preventDefault();
    onSave({ weight: weight ? parseFloat(weight) : null, sets: parseInt(sets, 10), reps: parseInt(reps, 10) });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass()} style={{ flex: 1 }} placeholder="kg" />
      <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} className={inputClass()} style={{ flex: 1 }} placeholder="series" />
      <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} className={inputClass()} style={{ flex: 1 }} placeholder="reps" />
      <button type="submit" className="rounded-md p-1.5" style={{ color: "var(--accent-strong)" }} aria-label="Guardar">
        <Check size={16} />
      </button>
      <EditButton editing onClick={onCancel} label="Cancelar" />
    </form>
  );
}

export function ExerciseLogHistoryList({ logs, onUpdate, onDelete, recordLogId }) {
  const [editingId, setEditingId] = useState(null);
  const sorted = [...logs].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={History}>Historial</SectionHeading>
      </div>
      {sorted.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={History}>Todavía no registraste sesiones de este ejercicio.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {sorted.map((log) =>
              editingId === log.id ? (
                <EditRow key={log.id} log={log} onSave={(data) => { onUpdate(log.id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              ) : (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm tabular-nums flex items-center gap-1.5">
                      {log.weight ? `${log.weight}kg × ` : ""}
                      {log.sets}×{log.reps}
                      {log.id === recordLogId && <PrBadge />}
                    </p>
                    {log.notes && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                        {log.notes}
                      </p>
                    )}
                  </div>
                  <p className="text-xs font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                    {formatDateTime(log.recordedAt)}
                  </p>
                  <EditButton onClick={() => setEditingId(log.id)} label="Editar" />
                  <DeleteButton onClick={() => onDelete(log.id)} label="Borrar" />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
