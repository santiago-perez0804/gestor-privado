import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { MEASUREMENT_TYPE_LABELS } from "../../lib/icons.js";
import { todayDateInputValue } from "../../lib/format.js";
import { Ruler } from "lucide-react";

export function MeasurementQuickForm({ onAdd }) {
  const [type, setType] = useState("cintura");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayDateInputValue());

  function submit(e) {
    e.preventDefault();
    const n = parseFloat(value);
    if (!n || n <= 0) return;
    onAdd({ type, value: n, date });
    setValue("");
  }

  return (
    <Card>
      <SectionHeading icon={Ruler}>Nueva medida</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Zona</FieldLabel>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass()}>
              {Object.entries(MEASUREMENT_TYPE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Valor (cm)</FieldLabel>
            <input type="number" step="0.1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>Fecha</FieldLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass()} />
        </div>
        <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          <Plus size={16} />
          Agregar medida
        </button>
      </form>
    </Card>
  );
}
