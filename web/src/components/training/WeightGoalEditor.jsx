import { useState } from "react";
import { Target, Check } from "lucide-react";
import { inputClass } from "../common/FieldLabel.jsx";

export function WeightGoalEditor({ goal, onSave }) {
  const [value, setValue] = useState(goal || "");

  function submit(e) {
    e.preventDefault();
    if (!value) return;
    onSave(value);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Target size={15} style={{ color: "var(--accent)" }} className="shrink-0" />
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        placeholder="Meta de peso (kg)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass()}
        style={{ flex: 1 }}
      />
      <button
        type="submit"
        className="flex items-center justify-center rounded-lg px-3 shrink-0 py-2"
        style={{ background: "var(--accent)", color: "#fff" }}
        aria-label="Guardar meta"
      >
        <Check size={16} />
      </button>
    </form>
  );
}
