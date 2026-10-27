import { useEffect, useRef, useState } from "react";
import { Camera, ChevronsLeftRight, Film, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Panel } from "../../components/common/Section.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { POSES, VARIANTS, localDate, num, signed } from "../../lib/fisico/index.js";
import { preparePhoto } from "../../lib/fisico/photoProcess.js";
import { useFisico } from "./FisicoContext.jsx";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const short = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
const longDay = (d) => `${WEEKDAYS[new Date(`${d}T12:00:00`).getDay()]} ${Number(d.slice(8, 10))} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const BLUR_KEY = "fisico.photos.blur";

function readBlur() {
  try {
    return localStorage.getItem(BLUR_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Antes / después con una división que se arrastra (o con el control de abajo). */
function Comparator({ before, after, labels }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const dragging = useRef(false);
  const move = (e) => {
    if (!dragging.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div>
      <div
        ref={ref}
        className="relative mx-auto w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden select-none"
        style={{ background: "var(--surface-alt)", touchAction: "none" }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={() => (dragging.current = false)}
      >
        {before ? <img src={before} alt={`Foto del ${labels[0]}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} /> : null}
        {after ? <img src={after} alt={`Foto del ${labels[1]}`} className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} draggable={false} /> : null}
        <span className="absolute top-2 left-2 font-mono text-[11px] px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,.55)", color: "#fff" }}>
          {labels[0]}
        </span>
        <span className="absolute top-2 right-2 font-mono text-[11px] px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,.55)", color: "#fff" }}>
          {labels[1]}
        </span>
        <span className="absolute top-0 bottom-0 w-0.5" style={{ left: `${pos}%`, background: "#fff" }} />
        <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full flex items-center justify-center" style={{ left: `${pos}%`, background: "#fff", color: "#111" }}>
          <ChevronsLeftRight size={16} />
        </span>
      </div>
      <input type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Mover la división entre antes y después" className="w-full max-w-xs mx-auto block mt-3" />
    </div>
  );
}

/** Nueva sesión: una foto por pose (relajado y, si querés, contraído). Se procesan en el celular antes de subir. */
function NewSessionModal({ onClose, onSaved }) {
  const [date, setDate] = useState(() => localDate(new Date()));
  const [files, setFiles] = useState({}); // "front:relaxed" → File
  const [previews, setPreviews] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const pick = (slot, file) => {
    if (!file) return;
    setFiles((f) => ({ ...f, [slot]: file }));
    setPreviews((p) => ({ ...p, [slot]: URL.createObjectURL(file) }));
  };
  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const [slot, file] of Object.entries(files)) {
        const [pose, variant] = slot.split(":");
        const { image, thumb } = await preparePhoto(file);
        await api.uploadPhoto({ image, thumb, date, pose, variant });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message === "unreadable_image" ? "No se pudo leer una de las fotos." : `No se pudo subir (${err.message}).`);
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} labelledBy="photos-title" width="40rem">
      <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 id="photos-title" className="text-base font-semibold mr-auto">
          Nueva sesión de fotos
        </h2>
        <button onClick={onClose} aria-label="Cerrar" className="hover-surface w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <X size={18} />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <label className="flex items-center gap-2 text-sm">
          Fecha <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg px-3 text-sm" />
        </label>
        {Object.entries(VARIANTS).map(([variant, vLabel]) => (
          <div key={variant}>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              {vLabel}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(POSES).map(([pose, pLabel]) => {
                const slot = `${pose}:${variant}`;
                return (
                  <label key={slot} className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center gap-1 text-xs" style={{ border: "1px dashed var(--border)", background: "var(--surface-alt)", color: "var(--text-muted)" }}>
                    {previews[slot] ? <img src={previews[slot]} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <ImagePlus size={18} />}
                    <span className="relative px-1.5 py-0.5 rounded" style={previews[slot] ? { background: "rgba(0,0,0,.55)", color: "#fff" } : undefined}>
                      {pLabel}
                    </span>
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(slot, e.target.files?.[0])} />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          Antes de subirlas se les borran los datos ocultos (ubicación, celular) y quedan solo para vos.
        </p>
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="hover-surface h-10 px-4 text-sm" style={{ border: "1px solid var(--border)" }}>
            Cancelar
          </button>
          <button onClick={save} disabled={busy || !Object.keys(files).length} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            Guardar {Object.keys(files).length || ""} {Object.keys(files).length === 1 ? "foto" : "fotos"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Fotos() {
  const { version, bump } = useFisico();
  const listApi = useApi(() => api.getPhotos(), [version]);
  const [blur, setBlur] = useState(readBlur);
  const [pose, setPose] = useState("front");
  const [variant, setVariant] = useState("relaxed");
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const sessions = listApi.data?.sessions ?? [];
  const withPose = sessions.filter((s) => s.photos.some((p) => p.pose === pose && p.variant === variant));
  const a = withPose.find((s) => s.date === from) ?? withPose.at(-1);
  const b = withPose.find((s) => s.date === to) ?? withPose[0];
  const photoOf = (s) => s?.photos.find((p) => p.pose === pose && p.variant === variant);
  const cmpApi = useApi(() => (a && b && a.date < b.date ? api.comparePhotos(a.date, b.date) : Promise.resolve(null)), [a?.date, b?.date, version]);
  const c = cmpApi.data;
  const toggleBlur = () => {
    const next = !blur;
    setBlur(next);
    try {
      localStorage.setItem(BLUR_KEY, next ? "1" : "0");
    } catch {
      // sin almacenamiento
    }
  };
  const next = listApi.data?.next;

  return (
    <PageTransition>
      <PageBar crumb="Físico · Cuerpo · solo vos las ves" title="Fotos de progreso">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          Difuminar miniaturas
          <input type="checkbox" checked={blur} onChange={toggleBlur} className="sr-only" />
          <span className="w-10 h-6 rounded-full relative transition-colors" style={{ background: blur ? "var(--accent)" : "var(--surface-alt)" }} aria-hidden="true">
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: blur ? "1.125rem" : "0.125rem" }} />
          </span>
        </label>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Camera size={16} /> Nueva sesión de fotos
        </button>
      </PageBar>

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <Panel className="lg:border-r lg:border-b">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-[15px] font-semibold">Comparar</h2>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg p-0.5" style={{ border: "1px solid var(--border)" }}>
                {Object.entries(VARIANTS).map(([id, l]) => (
                  <button key={id} onClick={() => setVariant(id)} aria-pressed={variant === id} className="h-8 px-3 rounded-md text-xs font-semibold" style={variant === id ? { background: "var(--surface-alt)" } : { color: "var(--text-muted)" }}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg p-0.5" style={{ border: "1px solid var(--border)" }}>
                {Object.entries(POSES).map(([id, l]) => (
                  <button key={id} onClick={() => setPose(id)} aria-pressed={pose === id} className="h-8 px-3 rounded-md text-xs font-semibold" style={pose === id ? { background: "var(--surface-alt)" } : { color: "var(--text-muted)" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {withPose.length >= 2 ? (
            <>
              <div className="flex flex-wrap justify-center gap-2 mb-3 text-sm">
                <select value={a.date} onChange={(e) => setFrom(e.target.value)} aria-label="Antes" className="h-9 rounded-lg px-2">
                  {withPose.map((s) => (
                    <option key={s.id} value={s.date} disabled={s.date >= b.date}>
                      {short(s.date)}
                    </option>
                  ))}
                </select>
                →
                <select value={b.date} onChange={(e) => setTo(e.target.value)} aria-label="Después" className="h-9 rounded-lg px-2">
                  {withPose.map((s) => (
                    <option key={s.id} value={s.date} disabled={s.date <= a.date}>
                      {short(s.date)}
                    </option>
                  ))}
                </select>
              </div>
              <Comparator before={api.photoUrl(photoOf(a).id)} after={api.photoUrl(photoOf(b).id)} labels={[short(a.date), short(b.date)]} />
            </>
          ) : (
            <p className="text-sm text-center py-16" style={{ color: "var(--text-muted)" }}>
              {withPose.length === 1 ? "Con una sesión más de esta pose aparece el comparador." : "Todavía no hay fotos de esta pose. Sacá la primera sesión."}
            </p>
          )}
        </Panel>
        <Panel className="lg:border-b">
          {c && (
            <>
              <h2 className="text-[15px] font-semibold">Entre estas dos fotos</h2>
              <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>
                {short(c.from)} → {short(c.to)} · {num(c.weeks, { max: 1 })} semanas
              </p>
              <dl className="space-y-2 text-sm">
                {[
                  ["Peso (tendencia)", c.trendKg != null ? `${signed(c.trendKg, { max: 1 })} kg` : "—"],
                  ["Cintura", c.waistCm != null ? `${signed(c.waistCm, { max: 1 })} cm` : "—"],
                  ["Brazo", c.armCm != null ? `${signed(c.armCm, { max: 1 })} cm` : "—"],
                  ["Entrenos hechos", c.workoutsPlanned ? `${c.workoutsDone} de ${c.workoutsPlanned}` : String(c.workoutsDone)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
              <hr className="my-4" style={{ borderColor: "var(--border)" }} />
            </>
          )}
          <h2 className="text-[15px] font-semibold mb-2">Para que se puedan comparar</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>Misma hora y luz: a la mañana, en ayunas, mismo lugar de la casa.</li>
            <li>Celular a la altura del ombligo, a la misma distancia (marcá el piso).</li>
            <li>Relajado y después contraído, en las tres poses.</li>
          </ul>
          <button disabled title="Próximamente" className="flex items-center gap-1.5 h-10 px-3.5 mt-4 rounded-xl text-sm opacity-50" style={{ border: "1px solid var(--border)" }}>
            <Film size={15} /> Armar timelapse
          </button>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-[15px] font-semibold">
            Sesiones <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>{sessions.length}</span>
          </h2>
          {next && (
            <span className="text-xs" style={{ color: next.overdue ? "var(--status-warning)" : "var(--text-muted)" }}>
              Cada {listApi.data.everyDays === 14 ? "2 semanas" : `${listApi.data.everyDays} días`} · {next.never ? "todavía no hay" : next.overdue ? "ya toca" : `la próxima el ${longDay(next.date).toLowerCase()}`}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl p-3" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold">{short(s.date)}</span>
                <span className="flex items-center gap-1">
                  {s.trendKg != null && (
                    <span className="font-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
                      tendencia {num(s.trendKg, { decimals: 1 })} kg
                    </span>
                  )}
                  <button onClick={async () => (await api.deletePhotoSession(s.id), bump())} aria-label={`Borrar las fotos del ${short(s.date)}`} className="hover-surface w-8 h-8 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.keys(POSES).map((p) => {
                  const ph = s.photos.find((x) => x.pose === p && x.variant === "relaxed") ?? s.photos.find((x) => x.pose === p);
                  return ph ? (
                    <button key={p} onClick={() => setViewing(ph)} className="aspect-[3/4] rounded-lg overflow-hidden" aria-label={`Ver ${POSES[p].toLowerCase()} del ${short(s.date)}`}>
                      <img src={api.photoUrl(ph.id, { thumb: true })} alt="" loading="lazy" className="w-full h-full object-cover" style={{ filter: blur ? "blur(10px)" : undefined, transform: blur ? "scale(1.1)" : undefined }} />
                    </button>
                  ) : (
                    <span key={p} className="aspect-[3/4] rounded-lg" style={{ background: "var(--surface-alt)" }} />
                  );
                })}
              </div>
            </div>
          ))}
          {next && (
            <div className="rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 min-h-[9rem]" style={{ border: "1px dashed var(--border)" }}>
              <Camera size={18} style={{ color: "var(--text-faint)" }} />
              <p className="text-sm font-semibold">{next.never ? "Primera sesión" : longDay(next.date)}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {next.never ? "Sacala hoy y empezá a comparar" : "Te lo recordamos en Inicio"}
              </p>
            </div>
          )}
        </div>
      </Panel>

      {adding && <NewSessionModal onClose={() => setAdding(false)} onSaved={bump} />}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.85)" }} onClick={() => setViewing(null)} role="dialog" aria-label="Foto">
          <img src={api.photoUrl(viewing.id)} alt="" className="max-h-full max-w-full rounded-xl" />
          <button onClick={() => setViewing(null)} aria-label="Cerrar" className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>
            <X size={20} />
          </button>
        </div>
      )}
    </PageTransition>
  );
}
