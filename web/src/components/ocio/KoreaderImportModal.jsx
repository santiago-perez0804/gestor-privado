import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { api } from "../../lib/api.js";
import { dayMonthYear, durationText } from "../../lib/ocio/outings.js";

const CONFIDENCE = { linked: "Ya vinculado", exact: "Coincide" };

/**
 * Importar estadísticas de KOReader en tres pasos: subir statistics.sqlite3 → confirmar a qué libro
 * de la biblioteca va cada uno (con sugerencias) → resumen. Subir el mismo archivo de nuevo no
 * duplica nada.
 */
export function KoreaderImportModal({ onClose, onImported }) {
  const [step, setStep] = useState("upload"); // upload | map | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [summary, setSummary] = useState(null);
  const [books, setBooks] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .getLibrary({ type: "book" })
      .then(setBooks)
      .catch(() => {});
  }, []);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api.previewKoreader(file);
      setPreview(p);
      setMapping(Object.fromEntries(p.books.map((b) => [b.key, b.match ? String(b.match.workId) : "new"])));
      setStep("map");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      setSummary(await api.importKoreader({ importId: preview.importId, mapping, gapMinutes: preview.gapMinutes }));
      setStep("done");
      onImported?.();
    } catch (err) {
      setError(`No se pudo importar (${err.message}).`);
    } finally {
      setBusy(false);
    }
  }

  const toImport = Object.values(mapping).filter((v) => v !== "skip").length;

  return (
    <Modal onClose={onClose} labelledBy="koreader-title" width={step === "map" ? "52rem" : "32rem"}>
      <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="koreader-title" className="text-base font-semibold mr-auto">
          Importar lecturas de KOReader
        </h2>
        <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>

      {step === "upload" && (
        <div className="p-6 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Conectá el Kindle por USB y buscá el archivo <code className="font-mono text-xs">koreader/settings/statistics.sqlite3</code>. Se lee sin modificarlo; podés volver a subirlo cuando quieras (no duplica sesiones).
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setDragging(true))}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files?.[0]);
            }}
            className="w-full rounded-xl flex flex-col items-center gap-2 py-10 text-sm"
            style={{ border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--border)"}`, background: dragging ? "color-mix(in srgb, var(--accent) 6%, transparent)" : undefined }}
          >
            {busy ? <Loader2 size={22} className="animate-spin" /> : <FileUp size={22} style={{ color: "var(--accent)" }} />}
            <span className="font-semibold">{busy ? "Leyendo el archivo…" : "Arrastrá statistics.sqlite3 o tocá para elegirlo"}</span>
          </button>
          <input ref={inputRef} type="file" accept=".sqlite3,.sqlite,.db" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>
      )}

      {step === "map" && preview && (
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {preview.books.length} {preview.books.length === 1 ? "libro con lecturas" : "libros con lecturas"}. Revisá a qué libro de tu biblioteca corresponde cada uno.
          </p>
          <div className="thin-scroll max-h-[26rem] overflow-y-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
            {preview.books.map((b, i) => (
              <div key={b.key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] items-center px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                <div className="min-w-0 flex gap-3">
                  <BookOpen size={16} className="shrink-0 mt-0.5" style={{ color: "var(--ocio-book)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{b.title}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                      {[b.authors?.replace(/\n/g, ", "), `${b.sessionCount} sesiones`, durationText(b.totalSeconds), b.lastRead && `última ${dayMonthYear(b.lastRead)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={mapping[b.key]}
                    onChange={(e) => setMapping((m) => ({ ...m, [b.key]: e.target.value }))}
                    className="h-9 rounded-lg px-2 text-sm flex-1 min-w-0"
                    aria-label={`A qué libro va ${b.title}`}
                  >
                    <option value="new">Agregar a la biblioteca</option>
                    <option value="skip">No importar</option>
                    <optgroup label="Tus libros">
                      {books.map((lb) => (
                        <option key={lb.workId} value={String(lb.workId)}>
                          {lb.title}
                          {lb.creators[0] ? ` · ${lb.creators[0]}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {b.match && String(b.match.workId) === mapping[b.key] && (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0" style={{ background: "color-mix(in srgb, var(--status-good) 14%, transparent)", color: "var(--status-good)" }}>
                      {CONFIDENCE[b.match.confidence]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setStep("upload")} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
              Otro archivo
            </button>
            <button onClick={runImport} disabled={busy || toImport === 0} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              {busy && <Loader2 size={15} className="animate-spin" />}
              Importar {toImport} {toImport === 1 ? "libro" : "libros"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && summary && (
        <div className="p-6 text-center space-y-3">
          <CheckCircle2 size={30} className="mx-auto" style={{ color: "var(--status-good)" }} />
          <p className="text-sm">
            <b>{summary.sessionsNew}</b> sesiones nuevas{summary.sessionsUpdated ? <> y <b>{summary.sessionsUpdated}</b> actualizadas</> : null} de {summary.books} {summary.books === 1 ? "libro" : "libros"}
            {summary.created ? <>; se {summary.created === 1 ? "agregó 1 libro" : `agregaron ${summary.created} libros`} a la biblioteca</> : null}.
          </p>
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            Listo
          </button>
        </div>
      )}
    </Modal>
  );
}
