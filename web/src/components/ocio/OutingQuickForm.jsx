import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { IconPicker } from "../common/IconPicker.jsx";
import { OCIO_ICONS, OUTING_ICON } from "../../lib/icons.js";
import { todayDateInputValue } from "../../lib/format.js";

export function OutingQuickForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [plannedDate, setPlannedDate] = useState(todayDateInputValue());
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [icon, setIcon] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!title.trim() || !plannedDate) return;
    onAdd({
      title: title.trim(),
      category: category.trim() || null,
      plannedDate,
      location: location.trim() || null,
      notes: notes.trim() || null,
      icon,
    });
    setTitle("");
    setCategory("");
    setLocation("");
    setNotes("");
    setIcon(null);
  }

  return (
    <Card>
      <SectionHeading icon={Plus}>Nueva salida</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex items-end gap-2">
          <IconPicker value={icon} autoIconName={OUTING_ICON} options={OCIO_ICONS} onChange={setIcon} />
          <div style={{ flex: 1 }}>
            <FieldLabel>Título</FieldLabel>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Cumpleaños de Fede" className={inputClass()} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Fecha</FieldLabel>
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <FieldLabel>Categoría</FieldLabel>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej. recital" className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>Lugar (opcional)</FieldLabel>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Notas (opcional)</FieldLabel>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass()} />
        </div>
        <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          <Plus size={16} />
          Agregar salida
        </button>
      </form>
    </Card>
  );
}
