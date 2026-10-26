import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Dices, LayoutGrid, List, Loader2, Plus, Search, Shuffle, Upload } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { WorkCover } from "../../components/ocio/WorkCover.jsx";
import { Stars } from "../../components/ocio/Stars.jsx";
import { ItemProgress, StatusPill, TypeLabel } from "../../components/ocio/bits.jsx";
import { KoreaderImportModal } from "../../components/ocio/KoreaderImportModal.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { STATUS_LABELS, TYPE_ORDER, WORK_TYPES, statusLabel, typeAndYear, typeBySlug } from "../../lib/ocio/types.js";
import { useOcio } from "./OcioContext.jsx";

const PREVIEW = 7;
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const SORTS = {
  recent: { label: "Más recientes", fn: (a, b) => (b.lastFinishedAt || b.updatedAt).localeCompare(a.lastFinishedAt || a.updatedAt) },
  title: { label: "Título", fn: (a, b) => a.title.localeCompare(b.title, "es") },
  year: { label: "Año", fn: (a, b) => (b.year || 0) - (a.year || 0) },
  rating: { label: "Puntuación", fn: (a, b) => (b.rating || 0) - (a.rating || 0) },
};
const select = "h-9 rounded-lg px-2.5 text-sm min-w-0";

function Card({ item }) {
  return (
    <Link to={`/ocio/obra/${item.id}`} className="group block min-w-0">
      <WorkCover item={item} badge className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      <p className="text-sm font-semibold mt-2.5 truncate">{item.title}</p>
      <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
        {typeAndYear(item)}
      </p>
      {item.status === "in_progress" ? (
        <ItemProgress item={item} compact />
      ) : item.status === "done" ? (
        item.rating ? (
          <div className="mt-1.5">
            <Stars value={item.rating} size={13} />
          </div>
        ) : null
      ) : (
        <div className="mt-1.5">
          <StatusPill item={item} />
        </div>
      )}
    </Link>
  );
}

function Row({ item }) {
  return (
    <Link to={`/ocio/obra/${item.id}`} className="movement-row flex items-center gap-3 px-4 lg:px-7 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <WorkCover item={item} size="thumb" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{item.title}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {[item.creators[0], item.year].filter(Boolean).join(" · ")}
        </p>
      </div>
      <TypeLabel type={item.type} className="hidden sm:inline-flex w-24" />
      <div className="w-36 hidden md:block">{item.status === "in_progress" ? <ItemProgress item={item} compact /> : <StatusPill item={item} />}</div>
      <div className="w-20 flex justify-end">{item.rating ? <Stars value={item.rating} size={12} /> : null}</div>
    </Link>
  );
}

function Grid({ items, view }) {
  if (view === "list")
    return (
      <div className="-mx-4 lg:-mx-7" style={{ borderTop: "1px solid var(--border)" }}>
        {items.map((it) => (
          <Row key={it.id} item={it} />
        ))}
      </div>
    );
  return (
    <div className="grid gap-x-4 gap-y-6 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
      {items.map((it) => (
        <Card key={it.id} item={it} />
      ))}
    </div>
  );
}

function Section({ title, items, view, all, onSeeAll, extra }) {
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <section className="px-4 lg:px-7 py-6 max-lg:-mx-4" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-[15px] font-semibold mr-auto">
          {title}
          <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-faint)" }}>
            {items.length}
          </span>
        </h2>
        {extra}
        {!all && items.length > PREVIEW && (
          <button onClick={onSeeAll} className="ghost-action text-xs font-semibold px-2 py-1 -mr-2" style={{ color: "var(--accent-strong)" }}>
            Ver los {items.length}
          </button>
        )}
      </div>
      <Grid items={shown} view={view} />
    </section>
  );
}

/** "Elegí uno por mí": uno al azar de tus pendientes, con la opción de empezarlo ya. */
function PickForMe({ pool, onClose, onStart }) {
  const [pick, setPick] = useState(() => pool[Math.floor(Math.random() * pool.length)]);
  const [busy, setBusy] = useState(false);
  const another = () => {
    if (pool.length < 2) return;
    let next = pick;
    while (next.id === pick.id) next = pool[Math.floor(Math.random() * pool.length)];
    setPick(next);
  };
  return (
    <Modal onClose={onClose} labelledBy="pick-title" width="24rem">
      <div className="p-6 text-center">
        <p id="pick-title" className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
          Te toca
        </p>
        <div className="w-32 mx-auto mt-4">
          <WorkCover item={pick} badge />
        </div>
        <p className="font-serif text-2xl mt-4 leading-tight">{pick.title}</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          {typeAndYear(pick)}
        </p>
        <div className="flex gap-2 mt-6">
          <button onClick={another} disabled={pool.length < 2} className="hover-surface flex-1 flex items-center justify-center gap-1.5 h-10 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--border)" }}>
            <Shuffle size={15} />
            Otro
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onStart(pick);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {pick.type === "book" ? "Empezar a leer" : pick.type === "game" ? "Empezar a jugar" : "Empezar a ver"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Biblioteca() {
  const { slug } = useParams();
  const type = typeBySlug(slug);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { version, openAdd, genreLabel, bump } = useOcio();
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const libraryApi = useApi(() => api.getLibrary(), [version]);

  const status = params.get("estado") || "";
  const q = params.get("q") || "";
  const genre = params.get("genero") || "";
  const year = params.get("anio") || "";
  const minRating = Number(params.get("puntaje")) || 0;
  const sort = SORTS[params.get("orden")] ? params.get("orden") : "recent";
  const view = params.get("vista") === "lista" ? "list" : "grid";
  const setParam = (k, v) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: true }
    );

  const all = libraryApi.data || [];
  const ofType = useMemo(() => (type ? all.filter((i) => i.type === type) : all), [all, type]);
  const filtered = useMemo(() => {
    const needle = norm(q);
    return ofType
      .filter((i) => !needle || norm([i.title, i.originalTitle, ...i.creators, ...i.genres.map(genreLabel)].join(" ")).includes(needle))
      .filter((i) => !genre || i.genres.includes(genre))
      .filter((i) => !year || String(i.year) === year)
      .filter((i) => !minRating || (i.rating || 0) >= minRating)
      .sort(SORTS[sort].fn);
  }, [ofType, q, genre, year, minRating, sort, genreLabel]);

  const byStatus = (s) => filtered.filter((i) => i.status === s);
  const statusCounts = Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, ofType.filter((i) => i.status === s).length]));
  const genresPresent = [...new Set(ofType.flatMap((i) => i.genres))].sort((a, b) => genreLabel(a).localeCompare(genreLabel(b), "es"));
  const yearsPresent = [...new Set(ofType.map((i) => i.year).filter(Boolean))].sort((a, b) => b - a);
  const wantPool = ofType.filter((i) => i.status === "want");
  const verbFor = (s) => (type ? statusLabel(type, s) : STATUS_LABELS[s]);

  async function startPick(item) {
    await api.updateLibraryItem(item.id, { status: "in_progress" });
    bump();
    navigate(`/ocio/obra/${item.id}`);
  }

  return (
    <PageTransition>
      <PageBar crumb="Ocio" title={type ? WORK_TYPES[type].plural : "Biblioteca"}>
        <label className="relative w-full sm:w-72 order-last sm:order-none">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} />
          <input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar por título, autor o género…" aria-label="Buscar en la biblioteca" className="w-full h-10 rounded-lg pl-9 pr-3 text-sm" />
        </label>
        {(!type || type === "book") && (
          <button onClick={() => setImporting(true)} className="hover-surface flex items-center gap-1.5 h-10 px-3.5 text-sm font-medium" style={{ border: "1px solid var(--border)" }} title="Importar lecturas de KOReader (Kindle)">
            <Upload size={15} />
            Importar
          </button>
        )}
        <button onClick={() => openAdd(type || undefined)} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={16} />
          Agregar
        </button>
      </PageBar>

      <nav className="no-scrollbar flex gap-5 overflow-x-auto px-4 lg:px-7 max-lg:-mx-4" style={{ borderBottom: "1px solid var(--border)" }} aria-label="Tipo de obra">
        {[null, ...TYPE_ORDER].map((t) => {
          const active = t === type;
          const count = t ? all.filter((i) => i.type === t).length : all.length;
          return (
            <Link
              key={t ?? "all"}
              to={`/ocio/biblioteca${t ? `/${WORK_TYPES[t].slug}` : ""}${params.toString() ? `?${params}` : ""}`}
              className="flex items-center gap-1.5 py-3 text-sm whitespace-nowrap -mb-px"
              style={{ color: active ? "var(--text)" : "var(--text-muted)", fontWeight: active ? 600 : 500, borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}` }}
            >
              {t && <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: WORK_TYPES[t].color }} />}
              {t ? WORK_TYPES[t].plural : "Todo"}
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2 px-4 lg:px-7 py-3 max-lg:-mx-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex flex-wrap rounded-xl p-1 gap-0.5 mr-auto" style={{ border: "1px solid var(--border)" }} role="tablist" aria-label="Estado">
          {["", "want", "in_progress", "done", "dropped"].map((s) => (
            <button
              key={s || "all"}
              role="tab"
              aria-selected={status === s}
              onClick={() => setParam("estado", s)}
              className="h-8 px-3 rounded-lg text-sm whitespace-nowrap"
              style={{ background: status === s ? "var(--surface-alt)" : "transparent", color: status === s ? "var(--text)" : "var(--text-muted)", fontWeight: status === s ? 600 : 500 }}
            >
              {s ? `${verbFor(s)} · ${statusCounts[s]}` : "Todos"}
            </button>
          ))}
        </div>
        <select value={genre} onChange={(e) => setParam("genero", e.target.value)} className={select} aria-label="Género">
          <option value="">Género</option>
          {genresPresent.map((g) => (
            <option key={g} value={g}>
              {genreLabel(g)}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setParam("anio", e.target.value)} className={select} aria-label="Año">
          <option value="">Año</option>
          {yearsPresent.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={minRating || ""} onChange={(e) => setParam("puntaje", e.target.value)} className={select} aria-label="Puntuación mínima">
          <option value="">Puntuación</option>
          {[5, 4, 3, 2].map((r) => (
            <option key={r} value={r}>
              {r === 5 ? "5 estrellas" : `${r} o más`}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setParam("orden", e.target.value === "recent" ? "" : e.target.value)} className={select} aria-label="Orden">
          {Object.entries(SORTS).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg p-0.5" style={{ border: "1px solid var(--border)" }} role="group" aria-label="Vista">
          {[
            ["grid", LayoutGrid, "Grilla"],
            ["list", List, "Lista"],
          ].map(([id, Icon, name]) => (
            <button key={id} onClick={() => setParam("vista", id === "list" ? "lista" : "")} aria-pressed={view === id} aria-label={name} className="w-8 h-8 flex items-center justify-center rounded-md" style={{ background: view === id ? "var(--surface-alt)" : "transparent", color: view === id ? "var(--text)" : "var(--text-faint)" }}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {!libraryApi.data ? null : filtered.length === 0 ? (
        <div className="px-4 lg:px-7 py-16 text-center max-lg:-mx-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {all.length === 0 ? "Tu biblioteca está vacía. Agregá lo que estás viendo, leyendo o jugando." : "Nada coincide con estos filtros."}
          </p>
        </div>
      ) : status ? (
        <section className="px-4 lg:px-7 py-6 max-lg:-mx-4">
          <Grid items={filtered} view={view} />
        </section>
      ) : (
        <>
          <Section title={STATUS_LABELS.in_progress} items={byStatus("in_progress")} view={view} all />
          <Section title={type ? statusLabel(type, "done") : "Terminados"} items={byStatus("done")} view={view} onSeeAll={() => setParam("estado", "done")} />
          <Section
            title={STATUS_LABELS.want}
            items={byStatus("want")}
            view={view}
            onSeeAll={() => setParam("estado", "want")}
            extra={
              wantPool.length > 0 && (
                <button onClick={() => setPicking(true)} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm font-medium" style={{ border: "1px solid var(--border)" }}>
                  <Dices size={15} style={{ color: "var(--accent)" }} />
                  Elegí uno por mí
                </button>
              )
            }
          />
          <Section title={STATUS_LABELS.dropped} items={byStatus("dropped")} view={view} onSeeAll={() => setParam("estado", "dropped")} />
        </>
      )}

      {picking && <PickForMe pool={wantPool} onClose={() => setPicking(false)} onStart={startPick} />}
      {importing && <KoreaderImportModal onClose={() => setImporting(false)} onImported={bump} />}
    </PageTransition>
  );
}
