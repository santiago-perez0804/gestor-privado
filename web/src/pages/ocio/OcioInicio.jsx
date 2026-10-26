import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BookOpen, Clapperboard, Gamepad2, MapPin, Palette, Plus, Tv } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { WorkCover } from "../../components/ocio/WorkCover.jsx";
import { Stars } from "../../components/ocio/Stars.jsx";
import { ItemProgress, Panel, SectionTitle, TypeLabel } from "../../components/ocio/bits.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { todayDateInputValue } from "../../lib/format.js";
import { MONTHS_ES_ABBR } from "../../lib/billing.js";
import { TYPE_ORDER, WORK_TYPES } from "../../lib/ocio/types.js";
import { categoryInfo, dateTile, longDate, relativeDays, shortDay, weekdayName, OUTING_STATUS } from "../../lib/ocio/outings.js";
import { useOcio } from "./OcioContext.jsx";

const fmt1 = (n) => String(n).replace(".", ",");

function YearToggle({ years, value, onChange }) {
  return (
    <div className="flex rounded-xl p-1 gap-0.5" style={{ border: "1px solid var(--border)" }}>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          aria-pressed={value === y}
          className="h-8 px-3 rounded-lg text-sm font-mono"
          style={{ background: value === y ? "var(--surface-alt)" : "transparent", color: value === y ? "var(--text)" : "var(--text-faint)", fontWeight: value === y ? 600 : 500 }}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

/** Meta anual de libros: barra con la marca de "dónde tendrías que estar hoy" y edición en el lugar. */
function BookGoal({ goal, year, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal?.target ?? 12);
  async function save(e) {
    e.preventDefault();
    await api.setOcioGoal(year, "book", Number(draft) || 0);
    setEditing(false);
    onSaved();
  }
  if (editing)
    return (
      <form onSubmit={save} className="flex items-center gap-1.5 mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Meta
        <input autoFocus type="number" min="0" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-14 h-7 rounded-md px-1.5 font-mono text-xs" aria-label="Libros por año" />
        libros
        <button type="submit" className="ghost-action font-semibold px-1.5 py-0.5" style={{ color: "var(--accent-strong)" }}>
          OK
        </button>
      </form>
    );
  if (!goal)
    return (
      <button onClick={() => setEditing(true)} className="ghost-action text-[11px] mt-1 px-1.5 py-0.5 -mx-1.5" style={{ color: "var(--accent-strong)" }}>
        Poné una meta anual
      </button>
    );
  return (
    <button onClick={() => setEditing(true)} className="ghost-action block w-full text-left mt-1 -mx-1 px-1 py-0.5" title="Cambiar la meta">
      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        de {goal.target} de tu meta anual
      </span>
      <span className="relative block rounded-full mt-1.5" style={{ height: 4, background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
        <span className="block h-full rounded-full" style={{ width: `${goal.ratio * 100}%`, background: "var(--ocio-book)" }} />
        {goal.expectedNow != null && (
          <span className="absolute -top-1 -bottom-1" style={{ left: `${Math.min(1, goal.expectedNow / goal.target) * 100}%`, width: 2, background: "var(--text-muted)" }} title={`Hoy tendrías que ir por ${goal.expectedNow}`} />
        )}
      </span>
    </button>
  );
}

function Kpi({ icon: Icon, color, label, value, children, className = "" }) {
  return (
    <div className={`min-w-0 p-4 lg:px-5 lg:py-5 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] ${className}`}>
      <p className="flex items-center gap-1.5 text-xs truncate" style={{ color: "var(--text-muted)" }}>
        <Icon size={14} style={{ color }} className="shrink-0" />
        {label}
      </p>
      <p className="font-mono text-3xl font-semibold mt-2 leading-none">{value}</p>
      <div className="text-[11px] mt-1.5 truncate" style={{ color: "var(--text-faint)" }}>
        {children}
      </div>
    </div>
  );
}

/** Un bloque por cada cosa terminada, apilados por mes y pintados según el tipo. */
function MonthlyBlocks({ months, currentMonth }) {
  const max = Math.max(4, ...months.map((m) => m.total));
  const block = Math.max(8, Math.min(18, Math.floor(130 / max)));
  return (
    <div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-end" style={{ minHeight: max * (block + 3) + 18 }}>
        {months.map((m) => (
          <div key={m.month} className="flex flex-col items-stretch justify-end h-full">
            {m.total > 0 && (
              <span className="text-[10px] font-mono text-center mb-1" style={{ color: "var(--text-faint)" }}>
                {m.total}
              </span>
            )}
            <div className="flex flex-col-reverse gap-[3px]">
              {TYPE_ORDER.flatMap((t) => m.items.filter((it) => it.type === t)).map((it, i) => (
                <Link
                  key={`${it.entryId}-${i}`}
                  to={`/ocio/obra/${it.entryId}`}
                  title={`${it.title} · ${WORK_TYPES[it.type].label}`}
                  className="block rounded-[4px]"
                  style={{ height: block, background: WORK_TYPES[it.type].color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {MONTHS_ES_ABBR.map((name, i) => (
          <span key={name} className="text-[10px] sm:text-[11px] text-center" style={{ color: i === currentMonth ? "var(--text)" : "var(--text-faint)", fontWeight: i === currentMonth ? 600 : 400 }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewText({ review }) {
  const [shown, setShown] = useState(!review.hasSpoilers);
  if (!shown)
    return (
      <button onClick={() => setShown(true)} className="ghost-action text-xs mt-1 px-1.5 py-0.5 -mx-1.5" style={{ color: "var(--text-muted)" }}>
        Tiene spoilers · mostrar
      </button>
    );
  return (
    <p className="font-serif italic text-[15px] leading-snug mt-1 line-clamp-3" style={{ color: "var(--text-muted)" }}>
      {review.text}
    </p>
  );
}

export function OcioInicio() {
  const { version, openAdd, genreLabel, bump } = useOcio();
  const today = todayDateInputValue();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const homeApi = useApi(() => api.getOcioHome(year), [year, version]);
  const h = homeApi.data;

  return (
    <PageTransition>
      <PageBar crumb={`Ocio · ${longDate(today)}`} title="Inicio">
        <YearToggle years={[currentYear - 1, currentYear]} value={year} onChange={setYear} />
        <button onClick={() => openAdd()} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={16} />
          Agregar
        </button>
      </PageBar>

      {!h ? null : (
        <>
          <section aria-label={`Resumen de ${year}`} className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 lg:gap-0 lg:border-b mb-4 lg:mb-0 lg:[&>*]:border-r xl:[&>*:last-child]:border-r-0 lg:max-xl:[&>*:nth-child(-n+3)]:border-b">
            <Kpi icon={BookOpen} color="var(--ocio-book)" label="Libros leídos" value={h.finishedCount.book}>
              <BookGoal goal={h.goalBook} year={year} onSaved={bump} />
            </Kpi>
            <Kpi icon={Clapperboard} color="var(--ocio-movie)" label="Películas vistas" value={h.finishedCount.movie}>
              {fmt1(h.moviesPerMonth)} por mes
            </Kpi>
            <Kpi icon={Tv} color="var(--ocio-series)" label="Series terminadas" value={h.finishedCount.series}>
              {h.inProgressCount.series} viendo ahora
            </Kpi>
            <Kpi icon={Gamepad2} color="var(--ocio-game)" label="Juegos terminados" value={h.finishedCount.game}>
              {h.inProgressCount.game} jugando ahora
            </Kpi>
            <Kpi icon={Palette} color="var(--accent)" label="Dibujos" value={h.artworks}>
              en la galería
            </Kpi>
            <Kpi icon={MapPin} color="var(--text-muted)" label="Salidas" value={h.outings.yearCount}>
              {h.outings.thisWeekend ? `${h.outings.thisWeekend} este finde` : "nada este finde"}
            </Kpi>
          </section>

          <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
            <Panel className="lg:border-r lg:border-b">
              <SectionTitle to="/ocio/biblioteca" action="Ver biblioteca">
                En curso ahora
              </SectionTitle>
              {h.inProgress.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No tenés nada en curso. Elegí algo de tu lista de pendientes en la{" "}
                  <Link to="/ocio/biblioteca?estado=want" className="font-semibold" style={{ color: "var(--accent-strong)" }}>
                    biblioteca
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {h.inProgress.map((it) => (
                    <Link key={it.id} to={`/ocio/obra/${it.id}`} className="card-hover flex gap-3 rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
                      <WorkCover item={it} size="tile" />
                      <div className="min-w-0 flex-1">
                        <TypeLabel type={it.type} />
                        <p className="text-sm font-semibold truncate mt-0.5">{it.title}</p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {it.currentPass?.progress?.note || it.creators[0] || "—"}
                        </p>
                        <ItemProgress item={it} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="lg:border-b">
              <SectionTitle>En el atril</SectionTitle>
              <div className="rounded-xl flex flex-col items-center justify-center text-center gap-2 p-6" style={{ border: "1px dashed var(--border)", minHeight: 200 }}>
                <Palette size={22} style={{ color: "var(--text-faint)" }} />
                <p className="text-sm font-medium">Tu galería de dibujos</p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  Llega en una próxima fase: vas a poder subir tus dibujos y verlos rotar acá.
                </p>
              </div>
            </Panel>

            <Panel className="lg:border-r lg:border-b">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-[15px] font-semibold">Terminados por mes</h2>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {TYPE_ORDER.map((t) => (
                    <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span className="inline-block rounded-[3px]" style={{ width: 8, height: 8, background: WORK_TYPES[t].color }} />
                      {WORK_TYPES[t].plural}
                    </span>
                  ))}
                </div>
              </div>
              <MonthlyBlocks months={h.monthly} currentMonth={year === currentYear ? Number(today.slice(5, 7)) - 1 : -1} />
              <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
                Cada bloque es algo que terminaste. {h.totalFinished ? `Van ${h.totalFinished} en ${year === currentYear ? "lo que va del año" : year}.` : "Todavía nada este año."}
              </p>
              {h.undated.length > 0 && (
                <p className="flex items-start gap-2 text-xs mt-3 rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--status-warning) 10%, transparent)", color: "var(--text-muted)" }}>
                  <AlertCircle size={14} className="shrink-0 mt-px" style={{ color: "var(--status-warning)" }} />
                  <span>
                    {h.undated.length === 1 ? "Hay 1 terminado sin fecha" : `Hay ${h.undated.length} terminados sin fecha`} y no aparece{h.undated.length === 1 ? "" : "n"} en el gráfico:{" "}
                    {h.undated.map((u, i) => (
                      <span key={u.entryId}>
                        {i > 0 && ", "}
                        <Link to={`/ocio/obra/${u.entryId}`} className="font-semibold" style={{ color: "var(--text)" }}>
                          {u.title}
                        </Link>
                      </span>
                    ))}
                    . Entrá y completá cuándo lo terminaste.
                  </span>
                </p>
              )}
            </Panel>

            <Panel className="lg:border-b">
              <SectionTitle>Géneros favoritos</SectionTitle>
              {h.genres.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Cargá géneros en tus obras para ver qué te gusta más.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {h.genres.map((g) => (
                    <li key={g.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)_1.5rem] items-center gap-3 text-sm">
                      <span className="truncate">{genreLabel(g.id)}</span>
                      <span className="rounded-full overflow-hidden" style={{ height: 6, background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                        <span className="block h-full rounded-full" style={{ width: `${(g.count / h.genres[0].count) * 100}%`, background: "var(--accent)" }} />
                      </span>
                      <span className="font-mono text-xs text-right" style={{ color: "var(--text-muted)" }}>
                        {g.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {h.averageRating != null && (
                <div className="flex items-center gap-3 mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="font-mono text-3xl font-semibold">{fmt1(h.averageRating)}</span>
                  <div>
                    <Stars value={h.averageRating} />
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                      Tu puntuación promedio en {year}
                    </p>
                  </div>
                </div>
              )}
            </Panel>

            <Panel className="lg:border-r">
              <SectionTitle to="/ocio/biblioteca?estado=done" action="Ver terminados">
                Últimas reseñas
              </SectionTitle>
              {h.reviews.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Cuando termines algo, escribí qué te dejó: aparece acá.
                </p>
              ) : (
                <ul>
                  {h.reviews.map((r, i) => (
                    <li key={r.id} className="py-3.5 first:pt-0" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                      <Link to={`/ocio/obra/${r.entryId}`} className="flex gap-3">
                        <WorkCover item={r} size="thumb" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold">{r.title}</span>
                            <TypeLabel type={r.type} />
                            {r.rating && <Stars value={r.rating} size={12} />}
                            <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--text-faint)" }}>
                              {shortDay(r.createdAt.slice(0, 10)).slice(4)}
                            </span>
                          </div>
                          <ReviewText review={r} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <SectionTitle to="/ocio/salidas" action="Abrir calendario">
                Próximas salidas
              </SectionTitle>
              {h.outings.upcoming.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Nada planeado todavía.
                </p>
              ) : (
                <ul className="space-y-3">
                  {h.outings.upcoming.map((o) => {
                    const tile = dateTile(o.date);
                    const cat = categoryInfo(o.category);
                    return (
                      <li key={o.id} className="flex gap-3 items-start">
                        <span className="flex flex-col items-center justify-center rounded-lg shrink-0 w-11 h-12" style={{ border: "1px solid var(--border)" }}>
                          <span className="text-[9px] font-semibold tracking-wider" style={{ color: "var(--ocio-movie)" }}>
                            {tile.month}
                          </span>
                          <span className="font-mono text-lg leading-none font-semibold">{tile.day}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug">{o.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                            {[weekdayName(o.date), cat?.label, relativeDays(o.date, today)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0"
                          style={o.status === "confirmed" ? { background: "color-mix(in srgb, var(--status-good) 16%, transparent)", color: "var(--status-good)" } : { border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        >
                          {OUTING_STATUS[o.status].label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {h.outings.unconfirmed.length > 0 && (
                <div className="rounded-xl p-3.5 mt-4" style={{ background: "color-mix(in srgb, var(--status-warning) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--status-warning)" }}>
                    {h.outings.unconfirmed.length === 1 ? "1 salida sin confirmar" : `${h.outings.unconfirmed.length} salidas sin confirmar`}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {h.outings.unconfirmed.map((o) => o.title).join(" y ")} {h.outings.unconfirmed.length === 1 ? "ya pasó" : "ya pasaron"} y {h.outings.unconfirmed.length === 1 ? "sigue" : "siguen"} como pendiente. ¿Fuiste?
                  </p>
                  <Link to="/ocio/salidas" className="ghost-action inline-block text-xs font-semibold mt-2 px-1.5 py-1 -mx-1.5" style={{ color: "var(--status-warning)" }}>
                    Revisar ahora
                  </Link>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageTransition>
  );
}
