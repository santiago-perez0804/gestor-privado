import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Check, ImagePlus, Loader2, Maximize2, Settings2, Star, Upload } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { ArtworkImage, checker } from "../../components/ocio/Easel.jsx";
import { ArtworkModal } from "../../components/ocio/ArtworkModal.jsx";
import { EaselSettingsModal } from "../../components/ocio/EaselSettingsModal.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { MAX_IMAGE_MB, checkImageFile, makeThumbnail, EASEL_INTERVALS, EASEL_ORDERS } from "../../lib/ocio/gallery.js";
import { useOcio } from "./OcioContext.jsx";

const FILTERS = [
  ["todas", "Todas"],
  ["favoritas", "Favoritas"],
  ["atril", "En el atril"],
];

/** Sube los archivos de a uno: valida, arma la miniatura y avisa el estado de cada uno. */
function useUploads(onUploaded) {
  const [queue, setQueue] = useState([]); // { key, name, state: "uploading"|"done"|"error", message }
  const patch = (key, p) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));
  async function upload(files) {
    const list = [...files].map((file, i) => ({ file, key: `${Date.now()}-${i}-${file.name}` }));
    setQueue((q) => [...q.filter((x) => x.state === "uploading"), ...list.map(({ key, file }) => ({ key, name: file.name, state: "uploading" }))]);
    for (const { file, key } of list) {
      try {
        const check = await checkImageFile(file);
        if (check.error) throw new Error(check.error);
        let thumb = null;
        try {
          thumb = (await makeThumbnail(file)).blob;
        } catch {
          // sin miniatura se muestra el original: no frena la subida
        }
        const art = await api.uploadArtwork(file, thumb);
        patch(key, { state: "done", message: art.inventoryCode });
        onUploaded(art);
      } catch (err) {
        patch(key, { state: "error", message: err.message });
      }
    }
  }
  return { queue, upload, clear: () => setQueue((q) => q.filter((x) => x.state === "uploading")) };
}

export function Galeria() {
  const { bump, version } = useOcio();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some(([id]) => id === params.get("ver")) ? params.get("ver") : "todas";
  const artsApi = useApi(() => api.getArtworks(), [version]);
  const easelApi = useApi(() => api.getEasel(), []);
  const [editing, setEditing] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);
  // `bump` cambia la versión: recarga la lista y los contadores de la barra lateral.
  const { queue, upload, clear } = useUploads(bump);

  const arts = artsApi.data || [];
  const shown = arts.filter((a) => (filter === "favoritas" ? a.isFavorite : filter === "atril" ? a.showOnEasel : true));
  const settings = easelApi.data?.settings;

  async function toggleFavorite(a) {
    const updated = await api.updateArtwork(a.id, { isFavorite: !a.isFavorite });
    artsApi.setData((list) => list.map((x) => (x.id === a.id ? updated : x)));
  }

  // Arrastrar y soltar en cualquier parte de la pantalla.
  const dropHandlers = {
    onDragEnter: (e) => {
      if (![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => [...e.dataTransfer.types].includes("Files") && e.preventDefault(),
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
    },
  };

  const pick = () => inputRef.current?.click();

  return (
    <PageTransition>
      <div {...dropHandlers} className="relative min-h-[70vh]">
        <PageBar crumb="Ocio · Creación" title="Galería">
          <button onClick={() => setSettingsOpen(true)} disabled={!settings} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }} title="Configurar el atril">
            <Settings2 size={15} />
            <span className="max-sm:hidden">
              Atril{settings && ` · ${EASEL_INTERVALS.find((i) => i.id === settings.interval)?.label.toLowerCase()}`}
            </span>
          </button>
          <Link to="/museo" className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm font-semibold" style={{ border: "1px solid var(--border)" }}>
            <Maximize2 size={15} />
            Modo museo
          </Link>
          <button onClick={pick} className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Upload size={15} />
            Subir
          </button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif" multiple hidden onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
        </PageBar>

        <nav className="no-scrollbar flex gap-6 overflow-x-auto px-4 lg:px-7 max-lg:-mx-4" style={{ borderBottom: "1px solid var(--border)" }} aria-label="Filtro">
          {FILTERS.map(([id, label]) => {
            const n = id === "favoritas" ? arts.filter((a) => a.isFavorite).length : id === "atril" ? arts.filter((a) => a.showOnEasel).length : arts.length;
            return (
              <button key={id} onClick={() => setParams(id === "todas" ? {} : { ver: id }, { replace: true })} aria-current={filter === id ? "page" : undefined} className="py-3 text-sm whitespace-nowrap -mb-px" style={{ color: filter === id ? "var(--text)" : "var(--text-muted)", fontWeight: filter === id ? 600 : 500, borderBottom: `2px solid ${filter === id ? "var(--accent)" : "transparent"}` }}>
                {label} <span className="font-mono text-xs" style={{ color: "var(--text-faint)" }}>{n}</span>
              </button>
            );
          })}
        </nav>

        {queue.length > 0 && (
          <div className="mt-4 lg:mx-7 rounded-xl p-3 space-y-1.5" style={{ border: "1px solid var(--border)", background: "var(--surface)" }} aria-live="polite">
            {queue.map((q) => (
              <p key={q.key} className="flex items-center gap-2 text-sm min-w-0">
                {q.state === "uploading" ? <Loader2 size={14} className="animate-spin shrink-0" /> : q.state === "done" ? <Check size={14} className="shrink-0" style={{ color: "var(--status-ok, var(--accent))" }} /> : <AlertCircle size={14} className="shrink-0" style={{ color: "var(--danger)" }} />}
                <span className="truncate">{q.name}</span>
                <span className="text-xs shrink-0" style={{ color: q.state === "error" ? "var(--danger)" : "var(--text-faint)" }}>
                  {q.state === "uploading" ? "subiendo…" : q.message}
                </span>
              </p>
            ))}
            {queue.every((q) => q.state !== "uploading") && (
              <button onClick={clear} className="ghost-action text-xs px-1 -mx-1" style={{ color: "var(--text-muted)" }}>
                Listo, ocultar
              </button>
            )}
          </div>
        )}

        <div className="mt-4 lg:p-7 lg:mt-0">
          {artsApi.data && arts.length === 0 ? (
            <button onClick={pick} className="card-hover w-full rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-10" style={{ border: "2px dashed var(--border)", minHeight: 320 }}>
              <ImagePlus size={30} style={{ color: "var(--text-faint)" }} />
              <span className="text-base font-semibold">Subí tus dibujos</span>
              <span className="text-sm max-w-sm" style={{ color: "var(--text-muted)" }}>
                Arrastralos acá o tocá para elegirlos. PNG, JPG o GIF de hasta {MAX_IMAGE_MB} MB. El pixel art se guarda tal cual y se ve nítido a cualquier tamaño.
              </span>
            </button>
          ) : shown.length === 0 && artsApi.data ? (
            <p className="text-sm py-10 text-center" style={{ color: "var(--text-muted)" }}>
              {filter === "favoritas" ? "Todavía no marcaste favoritas: abrí una obra y tocá la estrella." : "Ninguna obra está en el atril."}
            </p>
          ) : (
            <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {shown.map((a) => (
                <li key={a.id} className="group relative">
                  <button onClick={() => setEditing(a)} className="card-hover block w-full text-left rounded-xl p-2" style={{ border: "1px solid var(--border)" }}>
                    <span className="flex items-center justify-center rounded-lg overflow-hidden aspect-square" style={checker}>
                      <ArtworkImage art={a} thumb className="w-full h-full p-2" />
                    </span>
                    <span className="flex items-baseline justify-between gap-2 px-1 pt-2 pb-0.5">
                      <span className="text-sm font-semibold truncate">{a.title}</span>
                      <span className="font-mono text-[10px] shrink-0" style={{ color: "var(--text-faint)" }}>
                        {a.inventoryCode}
                      </span>
                    </span>
                    {!a.showOnEasel && (
                      <span className="block px-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                        fuera del atril
                      </span>
                    )}
                  </button>
                  <button onClick={() => toggleFavorite(a)} aria-label={a.isFavorite ? "Quitar de favoritas" : "Marcar favorita"} aria-pressed={a.isFavorite} className={`absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center transition-opacity ${a.isFavorite ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`} style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)", color: "var(--accent)" }}>
                    <Star size={15} fill={a.isFavorite ? "currentColor" : "none"} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {settings && arts.length > 0 && (
            <p className="text-xs mt-5" style={{ color: "var(--text-faint)" }}>
              Atril: {EASEL_INTERVALS.find((i) => i.id === settings.interval)?.label.toLowerCase()}, orden {EASEL_ORDERS.find((o) => o.id === settings.order)?.label.toLowerCase()}
              {settings.showOnHome ? ", visible en Inicio." : ", oculto en Inicio."} Podés arrastrar imágenes a cualquier parte de esta pantalla.
            </p>
          )}
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--bg) 80%)", border: "2px dashed var(--accent)" }}>
            <p className="flex items-center gap-2 text-base font-semibold">
              <Upload size={18} /> Soltá para subir
            </p>
          </div>
        )}
      </div>

      {editing && (
        <ArtworkModal
          art={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            artsApi.setData((list) => list.map((x) => (x.id === updated.id ? updated : x)));
            easelApi.reload();
          }}
          onDeleted={bump}
        />
      )}
      {settingsOpen && settings && <EaselSettingsModal settings={settings} onClose={() => setSettingsOpen(false)} onSaved={(s) => easelApi.setData((e) => ({ ...e, settings: s }))} />}
    </PageTransition>
  );
}
