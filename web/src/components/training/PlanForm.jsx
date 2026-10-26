import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { IconPicker } from "../common/IconPicker.jsx";
import { PLAN_ROUTINE_ICONS } from "../../lib/icons.js";

export function PlanForm({ initial, submitLabel = "Crear plan", onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [icon, setIcon] = useState(initial?.icon || null);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || null, icon });
    if (!initial) {
      setName("");
      setDescription("");
      setIcon(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div className="flex items-end gap-2">
        <IconPicker value={icon} autoIconName="Dumbbell" options={PLAN_ROUTINE_ICONS} onChange={setIcon} />
        <div style={{ flex: 1 }}>
          <FieldLabel>Nombre del plan</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. PPL" className={inputClass()} />
        </div>
      </div>
      <div>
        <FieldLabel>Descripción (opcional)</FieldLabel>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Push / Pull / Legs, 5 días"
          className={inputClass()}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {initial ? <Check size={16} /> : <Plus size={16} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 text-sm font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text)" }}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
