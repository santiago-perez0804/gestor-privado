import { useState } from "react";
import { Loader2, Star, Trash2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { ArtworkImage, checker } from "./Easel.jsx";

const field = "w-full h-10 rounded-lg px-3 text-sm min-w-0";
const lbl = "block text-xs mb-1.5";

const ERRORS = { inventory_code_taken: "Ese código de inventario ya lo usa otra obra.", title_required: "Falta el título." };

/** Ficha de una obra: datos del rótulo, favorita, si aparece en el atril, y borrar. */
export function ArtworkModal({ art, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    title: art.title ?? "",
    technique: art.technique ?? "",
    sizeLabel: art.sizeLabel ?? "",
    createdOn: art.createdOn ?? "",
    inventoryCode: art.inventoryCode ?? "",
    description: art.description ?? "",
    isFavorite: art.isFavorite,
    showOnEasel: art.showOnEasel,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError(ERRORS.title_required);
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.updateArtwork(art.id, form));
      onClose();
    } catch (err) {
      setError(ERRORS[err.message] ?? `No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteArtwork(art.id);
      onDeleted(art.id);
      onClose();
    } catch (err) {
      setError(`No se pudo borrar (${err.message}).`);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="artwork-title" width="54rem">
      <form onSubmit={save} className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="relative flex items-center justify-center min-h-[16rem] md:min-h-[30rem] rounded-t-2xl md:rounded-tr-none md:rounded-l-2xl overflow-hidden" style={checker}>
          <ArtworkImage art={art} className="absolute inset-0 w-full h-full p-6" />
          <span className="absolute bottom-3 left-3 font-mono text-[11px] px-2 py-1 rounded-md" style={{ background: "color-mix(in srgb, var(--surface) 85%, transparent)", color: "var(--text-muted)" }}>
            {art.width} × {art.height} px · {art.mime?.replace("image/", "").toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col md:border-l max-md:border-t">
          <div className="flex items-center px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 id="artwork-title" className="text-base font-semibold mr-auto">
              Ficha de la obra
            </h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="p-5 space-y-3.5 flex-1">
            <label className="block">
              <span className={lbl} style={{ color: "var(--text-muted)" }}>
                Título
              </span>
              <input value={form.title} onChange={set("title")} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={lbl} style={{ color: "var(--text-muted)" }}>
                  Técnica
                </span>
                <input value={form.technique} onChange={set("technique")} placeholder="Aseprite, lápiz…" className={field} />
              </label>
              <label className="block">
                <span className={lbl} style={{ color: "var(--text-muted)" }}>
                  Código
                </span>
                <input value={form.inventoryCode} onChange={set("inventoryCode")} className={`${field} font-mono uppercase`} />
              </label>
              <label className="block">
                <span className={lbl} style={{ color: "var(--text-muted)" }}>
                  Fecha
                </span>
                <input type="date" value={form.createdOn} onChange={set("createdOn")} className={field} />
              </label>
              <label className="block">
                <span className={lbl} style={{ color: "var(--text-muted)" }}>
                  Medidas
                </span>
                <input value={form.sizeLabel} onChange={set("sizeLabel")} className={field} />
              </label>
            </div>
            <label className="block">
              <span className={lbl} style={{ color: "var(--text-muted)" }}>
                Descripción
              </span>
              <textarea value={form.description} onChange={set("description")} rows={3} className="w-full rounded-lg px-3 py-2 text-sm resize-y" />
            </label>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isFavorite} onChange={set("isFavorite")} />
              <Star size={14} fill={form.isFavorite ? "currentColor" : "none"} style={{ color: "var(--accent)" }} /> Favorita
            </label>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={form.showOnEasel} onChange={set("showOnEasel")} />
              Mostrar en el atril y en el modo museo
            </label>
            {error && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            {confirming ? (
              <span className="flex items-center gap-2 mr-auto text-sm">
                ¿Borrar?
                <button type="button" onClick={remove} disabled={busy} className="h-9 px-3 rounded-lg text-sm font-semibold" style={{ background: "var(--danger)", color: "#fff" }}>
                  Sí, borrar
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="ghost-action px-2 py-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="hover-surface mr-auto flex items-center gap-1.5 h-10 px-3 text-sm" style={{ color: "var(--danger)" }}>
                <Trash2 size={15} /> Borrar
              </button>
            )}
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
