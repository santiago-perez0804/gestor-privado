import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, MoreHorizontal, Pencil, Play, Plus, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { WorkCover } from "../../components/ocio/WorkCover.jsx";
import { Stars } from "../../components/ocio/Stars.jsx";
import { ProgressBar, TypeLabel } from "../../components/ocio/bits.jsx";
import { ManualWorkFields } from "../../components/ocio/AddToLibraryModal.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { todayDateInputValue } from "../../lib/format.js";
import { DEFAULT_UNIT, WORK_TYPES, progressRatio, statusLabel } from "../../lib/ocio/types.js";
import { dayMonthYear, durationText } from "../../lib/ocio/outings.js";
import { useOcio } from "./OcioContext.jsx";

const STATUSES = ["want", "in_progress", "done", "dropped"];
const EXTRA_KEY = { book: "pages", movie: "runtime", series: "seasons", game: "platforms" };
const fmt1 = (n) => String(n).replace(".", ",");
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86_400_000);

/** Celda de fecha editable: muestra "2 mar 2026" y abre el calendario nativo al tocarla. */
function DateCell({ label, value, onChange }) {
  const ref = useRef(null);
  return (
    <div className="relative min-w-0 px-4 py-3" style={{ background: "var(--bg)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <button type="button" onClick={() => ref.current?.showPicker?.()} className="ghost-action font-mono text-sm font-semibold mt-0.5 -mx-1 px-1 truncate max-w-full" title={`Cambiar: ${label.toLowerCase()}`}>
        {dayMonthYear(value) ?? <span style={{ color: "var(--text-faint)" }}>Agregar</span>}
      </button>
      <input ref={ref} type="date" value={value || ""} onChange={(e) => onChange(e.target.value || null)} tabIndex={-1} aria-hidden="true" className="absolute inset-0 opacity-0 pointer-events-none" />
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="min-w-0 px-4 py-3" style={{ background: "var(--bg)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="font-mono text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

/** Dónde vas: página / episodio / horas, con total opcional. Guarda al salir del campo. */
function ProgressEditor({ item, pass, onSave }) {
  const unit = pass.progress?.unit || DEFAULT_UNIT[item.type];
  const [current, setCurrent] = useState(pass.progress?.current ?? "");
  const [total, setTotal] = useState(pass.progress?.total ?? item.metadata?.pages ?? "");
  const [season, setSeason] = useState(pass.progress?.season ?? "");
  const [note, setNote] = useState(pass.progress?.note ?? "");
  const save = () =>
    onSave({
      unit,
      current: current === "" ? null : Number(current),
      total: total === "" ? null : Number(total),
      ...(item.type === "series" ? { season: season === "" ? null : Number(season) } : {}),
      ...(item.type === "game" ? { note: note || null } : {}),
    });
  const input = "h-9 rounded-lg px-2.5 text-sm font-mono w-20";
  const ratio = progressRatio({ current: Number(current), total: Number(total) });
  return (
    <div className="rounded-xl px-4 py-3.5" style={{ border: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        {item.type === "series" && (
          <>
            Temporada
            <input value={season} onChange={(e) => setSeason(e.target.value)} onBlur={save} inputMode="numeric" className={`${input} w-14`} aria-label="Temporada" />
          </>
        )}
        {unit === "page" ? "Vas por la página" : unit === "episode" ? "episodio" : unit === "hours" ? "Llevás" : "Vas por el minuto"}
        <input value={current} onChange={(e) => setCurrent(e.target.value)} onBlur={save} inputMode="numeric" className={input} aria-label="Dónde vas" />
        {unit === "hours" ? (
          <>
            horas
            <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} placeholder="Nota (ej. build Psique)" className="h-9 rounded-lg px-2.5 text-sm flex-1 min-w-[10rem]" aria-label="Nota" />
          </>
        ) : (
          <>
            de
            <input value={total} onChange={(e) => setTotal(e.target.value)} onBlur={save} inputMode="numeric" className={input} aria-label="Total" />
          </>
        )}
        {ratio != null && <span className="ml-auto font-mono text-xs">{Math.round(ratio * 100)}%</span>}
      </div>
      {ratio != null && <ProgressBar ratio={ratio} type={item.type} className="mt-3" />}
    </div>
  );
}

function ReviewBlock({ entryId, review, onChanged }) {
  const [editing, setEditing] = useState(!review);
  const [text, setText] = useState(review?.text ?? "");
  const [spoilers, setSpoilers] = useState(!!review?.hasSpoilers);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(review?.text ?? "");
    setSpoilers(!!review?.hasSpoilers);
    setEditing(!review);
  }, [review]);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    if (review) await api.updateReview(review.id, { text, hasSpoilers: spoilers });
    else await api.addReview(entryId, { text, hasSpoilers: spoilers });
    setBusy(false);
    onChanged();
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-[15px] font-semibold">Tu reseña</h2>
        {review && !editing && (
          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              {dayMonthYear(review.createdAt)} · {review.hasSpoilers ? "con spoilers" : "sin spoilers"}
            </span>
            <button onClick={() => setEditing(true)} className="hover-surface w-8 h-8 flex items-center justify-center" aria-label="Editar reseña" style={{ color: "var(--text-faint)" }}>
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="¿Qué te dejó? Escribilo para tu yo del futuro." className="w-full rounded-xl px-3.5 py-3 font-serif text-[17px] leading-relaxed resize-y" />
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <label className="flex items-center gap-2 text-sm mr-auto" style={{ color: "var(--text-muted)" }}>
              <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
              Tiene spoilers
            </label>
            {review && (
              <button onClick={() => setEditing(false)} className="hover-surface h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }}>
                Cancelar
              </button>
            )}
            <button onClick={save} disabled={busy || !text.trim()} className="h-9 px-4 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Guardar reseña
            </button>
          </div>
        </div>
      ) : (
        <div className="font-serif text-[17px] leading-relaxed space-y-3 max-w-3xl" style={{ color: "var(--text)" }}>
          {review.text.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Páginas por día (de las sesiones de lectura): un día por barra, con huecos en cero. */
function PagesPerDay({ sessions }) {
  const byDay = new Map();
  for (const s of sessions) {
    const day = s.startTime.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + s.pagesRead);
  }
  const days = [...byDay.keys()].sort();
  if (!days.length) return null;
  const all = [];
  for (let d = new Date(`${days[0]}T00:00:00`); d <= new Date(`${days.at(-1)}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    all.push({ day: key, pages: byDay.get(key) || 0 });
  }
  const max = Math.max(...all.map((x) => x.pages), 1);
  const mid = all[Math.floor(all.length / 2)];
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[15px] font-semibold">Páginas por día</h2>
        {sessions.some((s) => s.source === "koreader") && (
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
            <RefreshCw size={12} />
            Sincronizado desde KOReader
          </span>
        )}
      </div>
      <div className="flex items-end gap-1 h-24">
        {all.map((x) => (
          <span key={x.day} title={`${dayMonthYear(x.day)}: ${x.pages} págs`} className="flex-1 rounded-t" style={{ height: x.pages ? `${(x.pages / max) * 100}%` : 2, background: x.pages ? "var(--ocio-book)" : "var(--border)" }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-mono mt-1.5" style={{ color: "var(--text-faint)" }}>
        <span>{dayMonthYear(all[0].day).slice(0, -5)}</span>
        {all.length > 6 && <span>{dayMonthYear(mid.day).slice(0, -5)}</span>}
        <span>{dayMonthYear(all.at(-1).day).slice(0, -5)}</span>
      </div>
    </section>
  );
}

function Highlights({ workId, highlights, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  async function save(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await api.addHighlight(workId, { text, location: location || null, note: note || null });
    setText("");
    setLocation("");
    setNote("");
    setAdding(false);
    onChanged();
  }
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[15px] font-semibold">
          Subrayados
          {highlights.length > 0 && (
            <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-faint)" }}>
              {highlights.length}
            </span>
          )}
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="ghost-action text-xs font-semibold px-2 py-1 -mr-2" style={{ color: "var(--accent-strong)" }}>
            Agregar nota
          </button>
        )}
      </div>
      {adding && (
        <form onSubmit={save} className="rounded-xl p-3.5 mb-3 space-y-2" style={{ border: "1px solid var(--border)" }}>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="El texto que subrayaste" className="w-full rounded-lg px-3 py-2 font-serif italic text-[15px] resize-y" />
          <div className="flex flex-wrap gap-2">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Página (ej. p. 8)" className="h-9 rounded-lg px-2.5 text-sm w-32" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="h-9 rounded-lg px-2.5 text-sm flex-1 min-w-[10rem]" />
            <button type="button" onClick={() => setAdding(false)} className="hover-surface h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={!text.trim()} className="h-9 px-3 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              Guardar
            </button>
          </div>
        </form>
      )}
      {highlights.length === 0 && !adding ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Guardá las frases que te marcaron.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {highlights.map((h) => (
            <figure key={h.id} className="movement-row relative rounded-xl px-4 py-3.5" style={{ border: "1px solid var(--border)" }}>
              <blockquote className="font-serif italic text-[16px] leading-snug">{h.text}</blockquote>
              <figcaption className="flex justify-between gap-2 text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
                <span>{[h.location, h.note && `«${h.note}»`].filter(Boolean).join(" · ")}</span>
                <span className="whitespace-nowrap">{dayMonthYear(h.createdAt).slice(0, -5)}</span>
              </figcaption>
              <button
                onClick={async () => {
                  await api.deleteHighlight(h.id);
                  onChanged();
                }}
                aria-label="Borrar subrayado"
                className="row-actions hover-surface absolute top-2 right-2 w-7 h-7 flex items-center justify-center"
                style={{ color: "var(--text-faint)" }}
              >
                <X size={13} />
              </button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function EditModal({ item, onClose, onSaved }) {
  const extraKey = EXTRA_KEY[item.type];
  const extraValue = item.metadata?.[extraKey];
  const [draft, setDraft] = useState({
    title: item.title,
    creators: item.creators.join(", "),
    year: item.year ?? "",
    genres: item.genres,
    extra: Array.isArray(extraValue) ? extraValue.join(", ") : extraValue ?? "",
    cover: null,
    metadata: item.metadata,
  });
  const [format, setFormat] = useState(item.format ?? "");
  const [language, setLanguage] = useState(item.metadata?.language ?? "");
  const [recommendedBy, setRecommendedBy] = useState(item.recommendedBy ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const metadata = { ...item.metadata, language: language || undefined };
    if (draft.extra !== "") metadata[extraKey] = extraKey === "platforms" ? String(draft.extra).split(",").map((s) => s.trim()).filter(Boolean) : Number(draft.extra);
    else delete metadata[extraKey];
    await api.updateLibraryItem(item.id, {
      work: { title: draft.title.trim(), creators: draft.creators.split(",").map((s) => s.trim()).filter(Boolean), year: draft.year ? Number(draft.year) : null, genres: draft.genres, metadata },
      format: format || null,
      recommendedBy: recommendedBy || null,
    });
    setBusy(false);
    onSaved();
    onClose();
  }
  const field = "w-full h-10 rounded-lg px-3 text-sm";
  return (
    <Modal onClose={onClose} labelledBy="edit-title" width="34rem">
      <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="edit-title" className="text-base font-semibold mr-auto">
          Editar
        </h2>
        <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>
      <div className="p-6 space-y-3">
        <ManualWorkFields type={item.type} draft={draft} onChange={setDraft} />
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="block mb-1.5">Idioma</span>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Traducción al español" className={field} />
          </label>
          <label className="block text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="block mb-1.5">Formato</span>
            <input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="Kindle · KOReader" className={field} />
          </label>
        </div>
        <label className="block text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="block mb-1.5">Te lo recomendó</span>
          <input value={recommendedBy} onChange={(e) => setRecommendedBy(e.target.value)} placeholder="Opcional" className={field} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
            Cancelar
          </button>
          <button onClick={save} disabled={busy || !draft.title.trim()} className="h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ObraDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { genreLabel, bump } = useOcio();
  const detailApi = useApi(() => api.getLibraryItem(id), [id]);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);

  const d = detailApi.data;
  if (detailApi.error) return <p className="p-6 text-sm">No se encontró esta obra.</p>;
  if (!d) return null;
  const { item, passes, reviews, highlights, sessions, related } = d;
  const t = WORK_TYPES[item.type];
  const pass = item.currentPass;
  const refresh = () => {
    detailApi.reload();
    bump();
  };

  async function change(fn) {
    await fn();
    refresh();
  }

  const totalSeconds = sessions.reduce((s, x) => s + x.durationSeconds, 0);
  const totalPages = sessions.reduce((s, x) => s + x.pagesRead, 0);
  const extraKey = EXTRA_KEY[item.type];
  const extra = item.metadata?.[extraKey];
  const meta = [
    [t.creator, item.creators.join(", ")],
    [item.type === "book" ? "Publicado" : item.type === "game" ? "Lanzamiento" : "Estreno", item.year],
    item.type === "book" ? ["Páginas", extra] : item.type === "movie" ? ["Duración", extra && `${extra} min`] : item.type === "series" ? ["Temporadas", extra] : ["Plataformas", Array.isArray(extra) ? extra.join(", ") : extra],
    ["Idioma", item.metadata?.language],
    ["Formato", item.format],
    ["Recomendado por", item.recommendedBy],
  ].filter(([, v]) => v);

  return (
    <PageTransition>
      <div className="flex items-center gap-3 mb-4 lg:mb-0 lg:px-7 lg:py-3.5 lg:border-b">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="hover-surface w-9 h-9 flex items-center justify-center shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <ArrowLeft size={16} />
        </button>
        <nav className="flex items-center gap-2 text-sm min-w-0 mr-auto" aria-label="Ruta">
          <Link to="/ocio/biblioteca" className="ghost-action px-1 -mx-1 shrink-0" style={{ color: "var(--text-muted)" }}>
            Biblioteca
          </Link>
          <span style={{ color: "var(--text-faint)" }}>/</span>
          <Link to={`/ocio/biblioteca/${t.slug}`} className="ghost-action px-1 -mx-1 shrink-0" style={{ color: "var(--text-muted)" }}>
            {t.plural}
          </Link>
          <span style={{ color: "var(--text-faint)" }}>/</span>
          <span className="font-semibold truncate">{item.title}</span>
        </nav>
        <button onClick={() => setEditing(true)} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm font-medium shrink-0" style={{ border: "1px solid var(--border)" }}>
          <Pencil size={14} />
          Editar
        </button>
        <div className="relative shrink-0">
          <button onClick={() => setMenu((v) => !v)} aria-label="Más opciones" aria-expanded={menu} className="hover-surface w-9 h-9 flex items-center justify-center" style={{ border: "1px solid var(--border)" }}>
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-20 rounded-xl p-1 w-48" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
              <button
                onClick={async () => {
                  setMenu(false);
                  if (!window.confirm(`¿Eliminar “${item.title}” de tu biblioteca? Se borran también su reseña, subrayados y sesiones.`)) return;
                  await api.deleteLibraryItem(item.id);
                  bump();
                  navigate(`/ocio/biblioteca/${t.slug}`);
                }}
                className="hover-surface w-full flex items-center gap-2 h-9 px-2.5 text-sm"
                style={{ color: "var(--danger)" }}
              >
                <Trash2 size={14} />
                Eliminar de la biblioteca
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-7 lg:py-7">
        <aside className="space-y-5">
          <div className="max-w-[15rem] mx-auto lg:mx-0">
            <WorkCover item={item} size="hero" label={item.genres[0] ? genreLabel(item.genres[0]) : t.label} />
          </div>
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
              Estado
            </p>
            <div className="relative">
              {item.status === "done" && <Check size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--accent)" }} />}
              <select
                value={item.status}
                onChange={(e) => change(() => api.updateLibraryItem(item.id, { status: e.target.value, statusDate: todayDateInputValue() }))}
                className={`w-full h-10 rounded-lg ${item.status === "done" ? "pl-9" : "pl-3"} pr-3 text-sm font-semibold`}
                style={item.status === "done" ? { borderColor: "color-mix(in srgb, var(--accent) 55%, var(--border))", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" } : undefined}
                aria-label="Estado"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(item.type, s)}
                  </option>
                ))}
              </select>
            </div>
            {(item.status === "done" || item.status === "dropped") && (
              <button onClick={() => change(() => api.rereadLibraryItem(item.id))} className="hover-surface w-full flex items-center justify-center gap-1.5 h-9 mt-2 text-sm font-medium" style={{ border: "1px solid var(--border)" }}>
                <RotateCcw size={14} />
                {item.type === "book" ? "Releer" : item.type === "game" ? "Volver a jugar" : "Volver a ver"}
              </button>
            )}
            {item.status === "want" && (
              <button onClick={() => change(() => api.updateLibraryItem(item.id, { status: "in_progress" }))} className="w-full flex items-center justify-center gap-1.5 h-9 mt-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                <Play size={14} />
                Empezar
              </button>
            )}
          </div>

          {meta.length > 0 && (
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              {meta.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt style={{ color: "var(--text-faint)" }}>{k}</dt>
                  <dd className="truncate" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {related.length > 0 && (
            <div className="pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold mb-3">También en tu biblioteca</p>
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/ocio/obra/${r.id}`} className="flex items-center gap-3">
                      <WorkCover item={r} size="thumb" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{r.title}</span>
                        <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                          {[r.genres[0] && genreLabel(r.genres[0]), statusLabel(r.type, r.status).toLowerCase()].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="min-w-0 space-y-7">
          <header>
            <TypeLabel type={item.type} />
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.02] mt-1 break-words">{item.title}</h1>
            <p className="mt-2" style={{ color: "var(--text-muted)" }}>
              {[item.creators.join(", "), item.year].filter(Boolean).join(" · ")}
            </p>
            {item.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {item.genres.map((g) => (
                  <Link key={g} to={`/ocio/biblioteca?genero=${g}`} className="card-hover text-xs rounded-full px-2.5 py-1" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    {genreLabel(g)}
                  </Link>
                ))}
              </div>
            )}
          </header>

          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
              Tu puntuación
            </p>
            <div className="flex items-center gap-4">
              <Stars value={item.rating} size={26} onChange={(v) => change(() => api.updateLibraryItem(item.id, { rating: v }))} />
              <span className="font-mono">
                <b className="text-lg">{item.rating ? fmt1(item.rating) : "–"}</b>
                <span className="text-sm" style={{ color: "var(--text-faint)" }}>
                  {" "}
                  / 5
                </span>
              </span>
            </div>
          </div>

          {pass && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-px rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--border)" }}>
              <DateCell label="Empezado" value={pass.startedAt} onChange={(v) => change(() => api.updatePass(pass.id, { startedAt: v }))} />
              {pass.status !== "in_progress" && <DateCell label={pass.status === "dropped" ? "Abandonado" : "Terminado"} value={pass.finishedAt} onChange={(v) => change(() => api.updatePass(pass.id, { finishedAt: v }))} />}
              {pass.startedAt && pass.finishedAt && <StatCell label="Duración" value={`${daysBetween(pass.startedAt, pass.finishedAt) + 1} días`} />}
              {totalSeconds > 0 && <StatCell label={item.type === "book" ? "Tiempo leyendo" : "Tiempo"} value={durationText(totalSeconds)} />}
              {totalSeconds > 0 && totalPages > 0 && <StatCell label="Ritmo" value={`${Math.round(totalPages / (totalSeconds / 3600))} págs/h`} />}
            </div>
          )}

          {pass?.status === "in_progress" && <ProgressEditor key={pass.id} item={item} pass={pass} onSave={(progress) => change(() => api.updatePass(pass.id, { progress }))} />}

          {(item.status === "done" || reviews.length > 0) && <ReviewBlock entryId={item.id} review={reviews[0]} onChanged={refresh} />}

          {sessions.length > 0 && <PagesPerDay sessions={sessions} />}

          {item.type === "book" && <Highlights workId={item.workId} highlights={highlights} onChanged={refresh} />}

          {passes.length > 1 && (
            <section>
              <h2 className="text-[15px] font-semibold mb-2">Historial</h2>
              <ul className="space-y-1.5 text-sm">
                {passes.map((p) => (
                  <li key={p.id} className="flex gap-3">
                    <span className="font-mono w-8" style={{ color: "var(--text-faint)" }}>
                      {p.number}.ª
                    </span>
                    <span>
                      {[dayMonthYear(p.startedAt), dayMonthYear(p.finishedAt)].filter(Boolean).join(" – ") || "sin fechas"}
                      <span style={{ color: "var(--text-faint)" }}> · {statusLabel(item.type, p.status === "in_progress" ? "in_progress" : p.status).toLowerCase()}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {item.status !== "done" && reviews.length === 0 && item.status !== "want" && (
            <button onClick={() => change(() => api.updateLibraryItem(item.id, { status: "done", statusDate: todayDateInputValue() }))} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm font-medium" style={{ border: "1px solid var(--border)" }}>
              <Plus size={14} />
              Marcar como {statusLabel(item.type, "done").toLowerCase()}
            </button>
          )}
        </div>
      </div>

      {editing && <EditModal item={item} onClose={() => setEditing(false)} onSaved={refresh} />}
    </PageTransition>
  );
}
