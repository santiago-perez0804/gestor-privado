import { useState } from "react";
import { Check } from "lucide-react";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { toLocalDateTimeInputValue } from "../../lib/format.js";

export function QuickLogForm({ onSubmit, onCancel, defaultWeight }) {
  const [weight, setWeight] = useState(defaultWeight ?? "");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!sets || !reps) return;
    onSubmit({
      weight: weight ? parseFloat(weight) : null,
      sets: parseInt(sets, 10),
      reps: parseInt(reps, 10),
      notes: notes || null,
      recordedAt: toLocalDateTimeInputValue(),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl p-3 mt-2" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <FieldLabel>Kg</FieldLabel>
          <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Series</FieldLabel>
          <input type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Reps</FieldLabel>
          <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className={inputClass()} />
        </div>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className={inputClass()} />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          <Check size={15} />
          Registrar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 text-sm font-medium" style={{ background: "var(--surface)", color: "var(--text)" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
