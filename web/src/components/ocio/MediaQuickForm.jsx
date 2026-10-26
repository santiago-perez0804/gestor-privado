import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { IconPicker } from "../common/IconPicker.jsx";
import { OCIO_ICONS, MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS, MEDIA_TYPE_DEFAULTS } from "../../lib/icons.js";

export function MediaQuickForm({ defaultType, onAdd }) {
  const [type, setType] = useState(defaultType || "pelicula");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ type, title: title.trim(), icon, progressLabel: MEDIA_TYPE_DEFAULTS[type]?.progressLabel || null });
    setTitle("");
    setIcon(null);
  }

  return (
    <Card>
      <SectionHeading icon={Plus}>Agregar</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Tipo</FieldLabel>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass()}>
              {Object.entries(MEDIA_TYPE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <IconPicker value={icon} autoIconName={MEDIA_TYPE_ICONS[type]} options={OCIO_ICONS} onChange={setIcon} />
          </div>
        </div>
        <div>
          <FieldLabel>Título</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Dune" className={inputClass()} />
        </div>
        <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
          <Plus size={16} />
          Agregar
        </button>
      </form>
    </Card>
  );
}
