import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, LineChart, PlusCircle, Check } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { getIconComponent, pickExerciseIcon } from "../../lib/icons.js";
import { QuickLogForm } from "./QuickLogForm.jsx";

function EditPrescriptionRow({ item, onSave, onCancel }) {
  const [targetSets, setTargetSets] = useState(item.targetSets ?? "");
  const [targetReps, setTargetReps] = useState(item.targetReps ?? "");
  const [targetWeight, setTargetWeight] = useState(item.targetWeight ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  function submit(e) {
    e.preventDefault();
    onSave({
      targetSets: targetSets ? parseInt(targetSets, 10) : null,
      targetReps: targetReps || null,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      notes: notes || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <FieldLabel>Series</FieldLabel>
          <input type="number" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Reps</FieldLabel>
          <input value={targetReps} onChange={(e) => setTargetReps(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Kg</FieldLabel>
          <input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} className={inputClass()} />
        </div>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className={inputClass()} />
      <div className="flex gap-2">
        <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          <Check size={13} />
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function RoutineExerciseList({ exercises, onUpdate, onDelete, onLog }) {
  const [editingId, setEditingId] = useState(null);
  const [loggingId, setLoggingId] = useState(null);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={ClipboardList}>Ejercicios de la rutina</SectionHeading>
      </div>
      {exercises.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={ClipboardList}>Todavía no agregaste ejercicios a esta rutina.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {exercises.map((item) =>
              editingId === item.id ? (
                <EditPrescriptionRow
                  key={item.id}
                  item={item}
                  onSave={(data) => {
                    onUpdate(item.id, data);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3 px-5 py-3">
                    {(() => {
                      const Icon = getIconComponent(pickExerciseIcon(item.exercisePrimaryMuscles));
                      return <Icon size={16} style={{ color: "var(--accent)" }} className="shrink-0" />;
                    })()}
                    <div className="min-w-0 flex-1">
                      <Link to={`/fisico/ejercicio/${item.exerciseLibraryId}`} className="text-sm font-medium truncate block">
                        {item.exerciseName}
                      </Link>
                      <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                        {item.targetSets ?? "—"} series × {item.targetReps ?? "—"} reps
                        {item.targetWeight ? ` · ${item.targetWeight}kg` : ""}
                      </p>
                      {item.notes && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <Link to={`/fisico/ejercicio/${item.exerciseLibraryId}`} aria-label="Ver progreso" className="shrink-0 rounded-md p-1.5" style={{ color: "var(--text-faint)" }}>
                      <LineChart size={15} />
                    </Link>
                    <button
                      onClick={() => setLoggingId(loggingId === item.id ? null : item.id)}
                      aria-label="Registrar hoy"
                      className="shrink-0 rounded-md p-1.5"
                      style={{ color: loggingId === item.id ? "var(--accent-strong)" : "var(--text-faint)" }}
                    >
                      <PlusCircle size={16} />
                    </button>
                    <EditButton onClick={() => setEditingId(item.id)} label="Editar" />
                    <DeleteButton onClick={() => onDelete(item.id)} label="Quitar de la rutina" />
                  </div>
                  {loggingId === item.id && (
                    <div className="px-5 pb-3">
                      <QuickLogForm
                        defaultWeight={item.targetWeight ?? ""}
                        onSubmit={(data) => {
                          onLog(item.exerciseLibraryId, data);
                          setLoggingId(null);
                        }}
                        onCancel={() => setLoggingId(null)}
                      />
                    </div>
                  )}
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
