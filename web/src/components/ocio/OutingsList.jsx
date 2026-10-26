import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MapPin, X, RotateCcw } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { getIconComponent, OUTING_ICON, OUTING_STATUS_LABELS } from "../../lib/icons.js";
import { formatShortDate, todayDateInputValue } from "../../lib/format.js";

function EditRow({ outing, onSave, onCancel }) {
  const [title, setTitle] = useState(outing.title);
  const [plannedDate, setPlannedDate] = useState(outing.plannedDate);
  const [category, setCategory] = useState(outing.category || "");
  const [location, setLocation] = useState(outing.location || "");
  const [notes, setNotes] = useState(outing.notes || "");

  function submit(e) {
    e.preventDefault();
    onSave({ title, plannedDate, category: category || null, location: location || null, notes: notes || null });
  }

  return (
    <form onSubmit={submit} className="space-y-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass()} placeholder="Título" />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className={inputClass()} />
        <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass()} placeholder="Categoría" />
      </div>
      <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass()} placeholder="Lugar" />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass()} placeholder="Notas" />
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

function OutingRow({ outing, onEdit, onDelete, onStatus }) {
  const Icon = getIconComponent(outing.icon || OUTING_ICON);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-3 px-5 py-3"
      style={{ borderBottom: "1px solid var(--border)", opacity: outing.status === "cancelado" ? 0.5 : 1 }}
    >
      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 34, height: 34, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{outing.title}</p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          {formatShortDate(outing.plannedDate)}
          {outing.location ? ` · ${outing.location}` : ""}
          {outing.category ? ` · ${outing.category}` : ""}
        </p>
      </div>
      <span
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
        style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}
      >
        {OUTING_STATUS_LABELS[outing.status]}
      </span>
      {outing.status === "planeado" && (
        <>
          <button onClick={() => onStatus("hecho")} aria-label="Marcar hecho" className="shrink-0 rounded-md p-1.5" style={{ color: "var(--accent-strong)" }}>
            <Check size={15} />
          </button>
          <button onClick={() => onStatus("cancelado")} aria-label="Cancelar" className="shrink-0 rounded-md p-1.5" style={{ color: "var(--danger)" }}>
            <X size={15} />
          </button>
        </>
      )}
      {outing.status !== "planeado" && (
        <button onClick={() => onStatus("planeado")} aria-label="Volver a planeado" className="shrink-0 rounded-md p-1.5" style={{ color: "var(--text-faint)" }}>
          <RotateCcw size={14} />
        </button>
      )}
      <EditButton onClick={onEdit} label="Editar" />
      <DeleteButton onClick={onDelete} label="Borrar" />
    </motion.div>
  );
}

function Group({ title, items, editingId, setEditingId, onUpdate, onDelete }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide px-5 pt-3 pb-1" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <AnimatePresence initial={false}>
        {items.map((o) =>
          editingId === o.id ? (
            <EditRow key={o.id} outing={o} onSave={(data) => { onUpdate(o.id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
          ) : (
            <OutingRow
              key={o.id}
              outing={o}
              onEdit={() => setEditingId(o.id)}
              onDelete={() => onDelete(o.id)}
              onStatus={(status) => onUpdate(o.id, { status })}
            />
          )
        )}
      </AnimatePresence>
    </div>
  );
}

export function OutingsList({ outings, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const today = todayDateInputValue();
  const sorted = [...outings].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const upcoming = sorted.filter((o) => o.plannedDate >= today && o.status !== "cancelado");
  const past = sorted.filter((o) => o.plannedDate < today || o.status === "cancelado").reverse();

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={MapPin}>Salidas y planes</SectionHeading>
      </div>
      {outings.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={MapPin}>Todavía no cargaste ninguna salida.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <Group title="Próximas" items={upcoming} editingId={editingId} setEditingId={setEditingId} onUpdate={onUpdate} onDelete={onDelete} />
          <Group title="Pasadas" items={past} editingId={editingId} setEditingId={setEditingId} onUpdate={onUpdate} onDelete={onDelete} />
        </div>
      )}
    </Card>
  );
}
