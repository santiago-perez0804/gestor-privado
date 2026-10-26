import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clapperboard } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { RatingStars } from "./RatingStars.jsx";
import { getIconComponent, MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS, MEDIA_STATUS_LABELS } from "../../lib/icons.js";

function EditRow({ item, onSave, onCancel }) {
  const [status, setStatus] = useState(item.status);
  const [rating, setRating] = useState(item.rating);
  const [progressCurrent, setProgressCurrent] = useState(item.progressCurrent ?? "");
  const [progressTotal, setProgressTotal] = useState(item.progressTotal ?? "");
  const [progressLabel, setProgressLabel] = useState(item.progressLabel ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  function submit(e) {
    e.preventDefault();
    onSave({
      status,
      rating,
      progressCurrent: progressCurrent ? parseInt(progressCurrent, 10) : null,
      progressTotal: progressTotal ? parseInt(progressTotal, 10) : null,
      progressLabel: progressLabel || null,
      notes: notes || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <p className="text-sm font-medium">{item.title}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Estado</FieldLabel>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass()}>
            {Object.entries(MEDIA_STATUS_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Puntaje</FieldLabel>
          <RatingStars value={rating} onChange={setRating} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <FieldLabel>Progreso</FieldLabel>
          <input type="number" value={progressCurrent} onChange={(e) => setProgressCurrent(e.target.value)} placeholder="0" className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Total</FieldLabel>
          <input type="number" value={progressTotal} onChange={(e) => setProgressTotal(e.target.value)} placeholder="0" className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Unidad</FieldLabel>
          <input value={progressLabel} onChange={(e) => setProgressLabel(e.target.value)} placeholder="pág./cap./hs" className={inputClass()} />
        </div>
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className={inputClass()} />
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

export function MediaList({ items, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={Clapperboard}>Lista</SectionHeading>
      </div>
      {items.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Clapperboard}>No hay nada acá todavía.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {items.map((item) =>
              editingId === item.id ? (
                <EditRow key={item.id} item={item} onSave={(data) => { onUpdate(item.id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              ) : (
                <MediaRow key={item.id} item={item} onEdit={() => setEditingId(item.id)} onDelete={() => onDelete(item.id)} />
              )
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}

function MediaRow({ item, onEdit, onDelete }) {
  const Icon = getIconComponent(item.icon || MEDIA_TYPE_ICONS[item.type]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-3 px-5 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 34, height: 34, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}>
            {MEDIA_TYPE_LABELS[item.type]}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              color: item.status === "en_progreso" ? "var(--accent-strong)" : "var(--text-faint)",
              background: item.status === "en_progreso" ? "var(--accent-soft)" : "var(--surface-alt)",
            }}
          >
            {MEDIA_STATUS_LABELS[item.status]}
          </span>
          {item.progressCurrent != null && (
            <span className="text-[10px] font-mono" style={{ color: "var(--text-faint)" }}>
              {item.progressCurrent}
              {item.progressTotal ? `/${item.progressTotal}` : ""} {item.progressLabel || ""}
            </span>
          )}
        </div>
      </div>
      {item.rating && <RatingStars value={item.rating} size={12} />}
      <EditButton onClick={onEdit} label="Editar" />
      <DeleteButton onClick={onDelete} label="Borrar" />
    </motion.div>
  );
}
