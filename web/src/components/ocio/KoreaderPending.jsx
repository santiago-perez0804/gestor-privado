import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { KoreaderBookRows } from "./KoreaderBookRows.jsx";

/**
 * Libros que llegaron del Kindle y no se pudieron vincular solos: elegir a qué obra van, agregarlos
 * como nuevos o ignorarlos para siempre. Sus lecturas se importan al confirmar.
 */
export function KoreaderPendingStep({ onDone, onCancel }) {
  const [books, setBooks] = useState(null);
  const [library, setLibrary] = useState([]);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getKoreaderPending(), api.getLibrary({ type: "book" })])
      .then(([p, lib]) => {
        setBooks(p.books);
        setLibrary(lib);
        // Por defecto: el candidato más parecido si lo hay; si no, agregarlo a la biblioteca.
        setMapping(Object.fromEntries(p.books.map((b) => [b.key, b.candidates?.[0] ? String(b.candidates[0].workId) : "new"])));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      onDone(await api.resolveKoreaderPending(mapping));
    } catch (err) {
      setError(`No se pudo guardar (${err.message}).`);
      setBusy(false);
    }
  }

  if (!books && !error) return <div className="p-6 flex justify-center"><Loader2 size={20} className="animate-spin" /></div>;
  return (
    <div className="p-6 space-y-4">
      {books?.length ? (
        <>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {books.length === 1 ? "Este libro llegó" : `Estos ${books.length} libros llegaron`} del Kindle y no {books.length === 1 ? "coincide" : "coinciden"} con ninguno de tu biblioteca. Elegí qué hacer; las lecturas se importan al confirmar.
          </p>
          <KoreaderBookRows books={books} library={library} mapping={mapping} mode="pending" onChange={(key, value) => setMapping((m) => ({ ...m, [key]: value }))} />
        </>
      ) : (
        !error && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay libros pendientes.</p>
      )}
      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
          {books?.length ? "Después" : "Cerrar"}
        </button>
        {books?.length > 0 && (
          <button onClick={confirm} disabled={busy} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            Confirmar
          </button>
        )}
      </div>
    </div>
  );
}

export function KoreaderPendingModal({ onClose, onResolved }) {
  return (
    <Modal onClose={onClose} labelledBy="koreader-pending-title" width="52rem">
      <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="koreader-pending-title" className="text-base font-semibold mr-auto">
          Libros nuevos de KOReader
        </h2>
        <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>
      <KoreaderPendingStep
        onCancel={onClose}
        onDone={(summary) => {
          onResolved?.(summary);
          onClose();
        }}
      />
    </Modal>
  );
}
