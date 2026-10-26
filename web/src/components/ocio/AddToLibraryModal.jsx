import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Info, Loader2, Pencil, Plus, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { DateField } from "../common/DateField.jsx";
import { WorkCover } from "./WorkCover.jsx";
import { Stars } from "./Stars.jsx";
import { TypeLabel } from "./bits.jsx";
import { CatalogSearch } from "./CatalogSearch.jsx";
import { useOcio } from "../../pages/ocio/OcioContext.jsx";
import { api } from "../../lib/api.js";
import { todayDateInputValue } from "../../lib/format.js";
import { TYPE_ORDER, WORK_TYPES, statusLabel } from "../../lib/ocio/types.js";

const field = "w-full h-10 rounded-lg px-3 text-sm min-w-0";
const label = "block text-xs mb-1.5";

// Qué estados se ofrecen al agregar (una película casi nunca queda "a medio ver").
const STATUS_CHOICES = { movie: ["want", "done"], series: ["want", "in_progress", "done"], book: ["want", "in_progress", "done"], game: ["want", "in_progress", "done"] };

// Dato extra de cada tipo (va a metadata).
const EXTRA = {
  book: { key: "pages", label: "Páginas", numeric: true },
  movie: { key: "runtime", label: "Duración (min)", numeric: true },
  series: { key: "seasons", label: "Temporadas", numeric: true },
  game: { key: "platforms", label: "Plataformas", placeholder: "PC, Switch…" },
};

export const emptyDraft = () => ({ title: "", originalTitle: null, creators: "", year: "", genres: [], extra: "", cover: null, externalSource: null, externalId: null, metadata: {} });

/** Borrador de obra (lo que se edita) → objeto `work` para la API. */
export function draftToWork(type, d) {
  const extra = EXTRA[type];
  const metadata = { ...d.metadata };
  if (d.extra !== "" && d.extra != null) metadata[extra.key] = extra.numeric ? Number(d.extra) : String(d.extra).split(",").map((s) => s.trim()).filter(Boolean);
  return {
    type,
    title: d.title.trim(),
    originalTitle: d.originalTitle || null,
    creators: d.creators.split(",").map((s) => s.trim()).filter(Boolean),
    year: d.year ? Number(d.year) : null,
    genres: d.genres,
    coverUrl: d.cover || null,
    externalSource: d.externalSource,
    externalId: d.externalId,
    metadata,
  };
}

function GenrePicker({ value, onChange }) {
  const { genres, genreLabel } = useOcio();
  const options = Object.entries(genres).filter(([id]) => !value.includes(id));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1 py-0.5" style={{ border: "1px solid var(--border)" }}>
            {genreLabel(id)}
            <button type="button" onClick={() => onChange(value.filter((g) => g !== id))} aria-label={`Quitar ${genreLabel(id)}`} className="hover-surface !rounded-full p-0.5" style={{ color: "var(--text-faint)" }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      {value.length < 4 && (
        <select value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} className={field} aria-label="Agregar género">
          <option value="">Agregar género…</option>
          {options.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Datos de la obra cargados a mano. */
export function ManualWorkFields({ type, draft, onChange }) {
  const set = (k) => (e) => onChange({ ...draft, [k]: e.target.value });
  const extra = EXTRA[type];
  return (
    <div className="space-y-3">
      <div>
        <span className={label} style={{ color: "var(--text-muted)" }}>
          Título
        </span>
        <input value={draft.title} onChange={set("title")} className={field} placeholder="Ej. Dune" autoFocus />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2.5">
        <div>
          <span className={label} style={{ color: "var(--text-muted)" }}>
            {WORK_TYPES[type].creator}
          </span>
          <input value={draft.creators} onChange={set("creators")} className={field} placeholder="Separados por coma" />
        </div>
        <div>
          <span className={label} style={{ color: "var(--text-muted)" }}>
            Año
          </span>
          <input value={draft.year} onChange={set("year")} inputMode="numeric" className={field} placeholder="2021" />
        </div>
      </div>
      <div>
        <span className={label} style={{ color: "var(--text-muted)" }}>
          {extra.label}
        </span>
        <input value={draft.extra} onChange={set("extra")} inputMode={extra.numeric ? "numeric" : undefined} className={field} placeholder={extra.placeholder} />
      </div>
      <div>
        <span className={label} style={{ color: "var(--text-muted)" }}>
          Géneros
        </span>
        <GenrePicker value={draft.genres} onChange={(genres) => onChange({ ...draft, genres })} />
      </div>
    </div>
  );
}

/**
 * Agregar a la biblioteca. A la izquierda se busca la obra en el catálogo (o se carga a mano); a la
 * derecha, tu relación con ella: estado, fecha, puntuación y reseña.
 */
export function AddToLibraryModal({ initialType = "movie", onClose, onSaved }) {
  const { genreLabel } = useOcio();
  const [type, setType] = useState(initialType);
  const [draft, setDraft] = useState(emptyDraft);
  const [mode, setMode] = useState("search"); // search | manual
  const [status, setStatus] = useState("want");
  const [date, setDate] = useState(todayDateInputValue());
  const [rating, setRating] = useState(null);
  const [review, setReview] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [progress, setProgress] = useState("");
  const [another, setAnother] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const t = WORK_TYPES[type];
  const choices = STATUS_CHOICES[type];
  const work = useMemo(() => draftToWork(type, draft), [type, draft]);

  // Si cambia el tipo y el estado elegido no aplica (p. ej. "Leyendo" → película), vuelve a "Quiero".
  useEffect(() => {
    if (!choices.includes(status)) setStatus("want");
  }, [choices, status]);

  // Otro tipo de obra: se empieza de cero con el buscador.
  useEffect(() => {
    setDraft(emptyDraft());
    setMode("search");
  }, [type]);

  // ¿Ya está en la biblioteca? Se consulta con una pausa corta mientras se escribe.
  useEffect(() => {
    if (!work.title) return setDuplicate(null);
    const timer = setTimeout(() => {
      api
        .findLibraryDuplicate({ type, title: work.title, originalTitle: work.originalTitle, creators: work.creators.join("|"), year: work.year, externalSource: work.externalSource, externalId: work.externalId })
        .then((r) => setDuplicate(r.item))
        .catch(() => setDuplicate(null));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, work.title, work.originalTitle, work.creators.join("|"), work.year, work.externalSource, work.externalId]);

  async function save() {
    if (!work.title) return setError("Falta el título.");
    setSaving(true);
    setError(null);
    try {
      const pass = {};
      if (status === "done") pass.finishedAt = date;
      if (status === "in_progress") {
        pass.startedAt = date;
        if (progress) pass.progress = { current: Number(progress), ...(type === "book" && work.metadata.pages ? { total: work.metadata.pages } : {}) };
      }
      await api.addToLibrary({
        work,
        entry: { status, ...(rating ? { rating } : {}) },
        pass,
        review: review.trim() ? { text: review, hasSpoilers: spoilers } : undefined,
      });
      onSaved?.();
      if (another) {
        setDraft(emptyDraft());
        setMode("search");
        setRating(null);
        setReview("");
        setSpoilers(false);
        setProgress("");
      } else onClose();
    } catch (err) {
      setError(`No se pudo guardar (${err.message}).`);
    } finally {
      setSaving(false);
    }
  }

  const preview = { ...work, cover: draft.cover, creators: work.creators };
  const dateLabel = status === "done" ? (type === "movie" ? "La viste el" : type === "book" ? "Lo terminaste el" : "La terminaste el") : "Empezaste el";

  return (
    <Modal onClose={onClose} labelledBy="add-title">
      <div className="flex flex-wrap items-center gap-3 px-5 sm:px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="add-title" className="text-base font-semibold mr-auto">
          Agregar a la biblioteca
        </h2>
        <div className="flex rounded-xl p-1 gap-0.5" style={{ background: "var(--surface-alt)" }} role="tablist" aria-label="Tipo de obra">
          {TYPE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={type === id}
              onClick={() => setType(id)}
              className="flex items-center gap-1.5 rounded-lg px-3 h-8 text-sm"
              style={{ background: type === id ? "var(--surface)" : "transparent", color: type === id ? "var(--text)" : "var(--text-muted)", fontWeight: type === id ? 600 : 500 }}
            >
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: WORK_TYPES[id].color }} />
              {id === "game" ? "Juego" : WORK_TYPES[id].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="hover-surface flex items-center justify-center w-9 h-9" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="p-5 sm:p-6 md:border-r min-w-0 flex flex-col">
          {mode === "search" ? (
            <CatalogSearch
              key={type}
              type={type}
              selectedId={draft.externalId ? `${draft.externalSource}:${draft.externalId}` : null}
              onSelect={(d) => setDraft(d)}
              onManual={(q) => {
                setDraft((d) => (d.externalId ? { ...emptyDraft(), title: q } : { ...d, title: d.title || q }));
                setMode("manual");
              }}
            />
          ) : (
            <>
              <ManualWorkFields type={type} draft={draft} onChange={setDraft} />
              <button type="button" onClick={() => setMode("search")} className="ghost-action self-start flex items-center gap-1.5 text-xs font-semibold mt-4 px-1.5 py-1 -mx-1.5" style={{ color: "var(--accent-strong)" }}>
                <ArrowLeft size={13} />
                Volver a buscar en el catálogo
              </button>
            </>
          )}
        </div>

        <div className="p-5 sm:p-6 min-w-0 flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="w-24 shrink-0">
              <WorkCover item={preview.title ? preview : { ...preview, title: "Sin título" }} size="card" />
            </div>
            <div className="min-w-0">
              <TypeLabel type={type} />
              <p className="font-serif text-2xl leading-tight mt-0.5 break-words">{work.title || <span style={{ color: "var(--text-faint)" }}>Sin título</span>}</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {[work.creators.join(", "), work.year].filter(Boolean).join(" · ")}
              </p>
              {work.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {work.genres.map((g) => (
                    <span key={g} className="text-[11px] rounded-full px-2 py-0.5" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      {genreLabel(g)}
                    </span>
                  ))}
                </div>
              )}
              {mode === "search" && draft.externalId && (
                <button type="button" onClick={() => setMode("manual")} className="ghost-action flex items-center gap-1 text-[11px] font-semibold mt-2 px-1 py-0.5 -mx-1" style={{ color: "var(--accent-strong)" }}>
                  <Pencil size={11} />
                  Editar los datos
                </button>
              )}
            </div>
          </div>

          {duplicate && (
            <p className="flex items-start gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--text-muted)" }}>
              <Info size={14} className="shrink-0 mt-px" style={{ color: "var(--accent)" }} />
              <span>
                <b style={{ color: "var(--text)" }}>Ya está en tu biblioteca</b> ({statusLabel(duplicate.type, duplicate.status).toLowerCase()}). Guardar actualiza esa entrada en vez de duplicarla.
              </span>
            </p>
          )}

          <div>
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Estado
            </span>
            <div className="grid rounded-xl p-1 gap-1" style={{ background: "var(--surface-alt)", gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}>
              {choices.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className="h-9 rounded-lg text-sm truncate px-2"
                  style={{ background: status === s ? "var(--surface)" : "transparent", color: status === s ? "var(--text)" : "var(--text-muted)", fontWeight: status === s ? 600 : 500 }}
                >
                  {statusLabel(type, s)}
                </button>
              ))}
            </div>
          </div>

          {status !== "want" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label} style={{ color: "var(--text-muted)" }}>
                  {dateLabel}
                </span>
                <DateField value={date} onChange={setDate} label={dateLabel} />
              </div>
              {status === "done" ? (
                <div>
                  <span className={label} style={{ color: "var(--text-muted)" }}>
                    Puntuación{rating ? ` · ${String(rating).replace(".", ",")}` : " · sin puntuar"}
                  </span>
                  <div className="h-10 flex items-center">
                    <Stars value={rating} onChange={setRating} size={22} />
                  </div>
                </div>
              ) : (
                <div>
                  <span className={label} style={{ color: "var(--text-muted)" }}>
                    {type === "book" ? "Vas por la página" : type === "series" ? "Vas por el episodio" : "Horas jugadas"}
                  </span>
                  <input value={progress} onChange={(e) => setProgress(e.target.value)} inputMode="numeric" className={field} placeholder="Opcional" />
                </div>
              )}
            </div>
          )}

          {status === "done" && (
            <div>
              <span className={label} style={{ color: "var(--text-muted)" }}>
                Reseña <span style={{ color: "var(--text-faint)" }}>(opcional)</span>
              </span>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                placeholder="¿Qué te dejó? Escribilo para tu yo del futuro."
                className="w-full rounded-lg px-3 py-2.5 font-serif text-[15px] leading-relaxed resize-y"
              />
              <label className="flex items-center gap-2 text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
                Tiene spoilers
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="mt-auto pt-4 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
            <label className="flex items-center gap-2 text-sm mr-auto" style={{ color: "var(--text-muted)" }}>
              <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} />
              Agregar otro después
            </label>
            <button type="button" onClick={onClose} className="hover-surface h-10 px-4 text-sm font-medium" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !work.title}
              className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : duplicate ? <Check size={16} /> : <Plus size={16} />}
              {duplicate ? "Actualizar" : "Agregar a la biblioteca"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
