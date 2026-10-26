import { useState } from "react";
import { Plus } from "lucide-react";
import { inputClass } from "../common/FieldLabel.jsx";
import { WeightTip } from "./WeightTip.jsx";
import { toLocalDateTimeInputValue } from "../../lib/format.js";

export function WeightQuickForm({ onAdd }) {
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState(() => toLocalDateTimeInputValue());

  function submit(e) {
    e.preventDefault();
    const n = parseFloat(value);
    if (!n || n <= 0) return;
    onAdd({ weight: n, recordedAt });
    setValue("");
    setRecordedAt(toLocalDateTimeInputValue());
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="Nuevo peso (kg)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass()}
          style={{ flex: 1 }}
        />
        <input
          type="datetime-local"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          className={inputClass()}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="flex items-center justify-center rounded-lg px-3 shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
          aria-label="Actualizar peso"
        >
          <Plus size={18} />
        </button>
      </div>
      <WeightTip />
    </form>
  );
}
