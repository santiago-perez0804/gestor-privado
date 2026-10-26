import { useState } from "react";
import { Check } from "lucide-react";
import { inputClass } from "../common/FieldLabel.jsx";
import { categoryLabel } from "../../lib/expenseCategories.js";

export function BudgetEditRow({ categoryId, currentLimit, currentRollover = false, onSave, onCancel }) {
  const [value, setValue] = useState(currentLimit ?? "");
  const [rollover, setRollover] = useState(!!currentRollover);

  function submit(e) {
    e.preventDefault();
    const n = parseFloat(value);
    if (!n || n <= 0) return;
    onSave(n, rollover);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-2 flex-wrap">
      <span className="text-sm flex-1">{categoryLabel(categoryId)}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Límite mensual"
        className={inputClass()}
        style={{ width: 130 }}
      />
      <label className="flex items-center gap-1 text-[11px] w-full order-last" style={{ color: "var(--text-muted)" }} title="Lo que sobre (o te pases) este período se suma al tope del siguiente">
        <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
        Arrastrar sobrante al período siguiente
      </label>
      <button type="submit" className="rounded-md p-1.5" style={{ color: "var(--accent-strong)" }} aria-label="Guardar">
        <Check size={16} />
      </button>
      <button type="button" onClick={onCancel} className="ghost-action text-xs font-medium px-2 py-1" style={{ color: "var(--text-faint)" }}>
        Cancelar
      </button>
    </form>
  );
}
