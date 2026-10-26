import { useState } from "react";
import { Plus } from "lucide-react";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { ExercisePicker } from "./ExercisePicker.jsx";

export function RoutineExerciseForm({ onSubmit, onCancel }) {
  const [exercise, setExercise] = useState(null);
  const [targetSets, setTargetSets] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!exercise) return;
    onSubmit({
      exerciseLibraryId: exercise.id,
      targetSets: targetSets ? parseInt(targetSets, 10) : null,
      targetReps: targetReps || null,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      notes: notes || null,
    });
  }

  if (!exercise) {
    return <ExercisePicker onSelect={setExercise} onClose={onCancel} />;
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-medium">{exercise.name}</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <FieldLabel>Series</FieldLabel>
          <input type="number" inputMode="numeric" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} placeholder="4" className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Reps</FieldLabel>
          <input value={targetReps} onChange={(e) => setTargetReps(e.target.value)} placeholder="8-12" className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Kg objetivo</FieldLabel>
          <input type="number" inputMode="decimal" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="0" className={inputClass()} />
        </div>
      </div>
      <div>
        <FieldLabel>Notas (opcional)</FieldLabel>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Agarre ancho" className={inputClass()} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <Plus size={16} />
          Agregar a la rutina
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-4 text-sm font-medium" style={{ background: "var(--surface)", color: "var(--text)" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
