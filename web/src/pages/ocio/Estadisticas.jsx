import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Flame, RefreshCw, Sparkles, Table2 } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { MonthlyBlocks } from "../../components/ocio/MonthlyBlocks.jsx";
import { YearToggle } from "../../components/ocio/YearToggle.jsx";
import { WorkCover } from "../../components/ocio/WorkCover.jsx";
import { Stars } from "../../components/ocio/Stars.jsx";
import { Panel } from "../../components/ocio/bits.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { todayDateInputValue } from "../../lib/format.js";
import { MONTHS_ES, MONTHS_ES_ABBR } from "../../lib/billing.js";
import { TYPE_ORDER, WORK_TYPES } from "../../lib/ocio/types.js";
import { dayMonthYear, durationText } from "../../lib/ocio/outings.js";
import { useOcio } from "./OcioContext.jsx";

const TABS = [["general", "General"], ...TYPE_ORDER.map((t) => [t, WORK_TYPES[t].plural])];
const fmt1 = (n) => String(n).replace(".", ",");
const WEEK_LABELS = ["Lun", "", "Mié", "", "Vie", "", "Dom"];
const HEAT = ["color-mix(in srgb, var(--text) 8%, transparent)", "color-mix(in srgb, var(--accent) 30%, transparent)", "color-mix(in srgb, var(--accent) 50%, transparent)", "color-mix(in srgb, var(--accent) 75%, transparent)", "var(--accent)"];

function Cell({ label, value, unit, sub, className = "" }) {
  return (
    <div className={`min-w-0 p-4 lg:p-5 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] ${className}`}>
      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1.5 leading-none">
        <span className="font-mono text-3xl font-semibold">{value ?? "–"}</span>
        {unit && (
          <span className="font-mono text-sm ml-1.5" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </p>
      {sub && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-faint)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Bars({ rows, color = "var(--accent)" }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key ?? r.label} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="rounded-full overflow-hidden" style={{ height: 8, background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
            <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} />
          </span>
          <span className="font-mono text-xs text-right" style={{ color: "var(--text-muted)" }}>
            {r.right ?? r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Columnas por mes (páginas, terminados…), con el valor arriba de las más altas. */
function MonthColumns({ values, color, currentMonth, format = (v) => v }) {
  const max = Math.max(1, ...values);
  const top = [...values].sort((a, b) => b - a).slice(0, 2);
  return (
    <div>
      <div className="grid grid-cols-12 gap-2 items-end h-44">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center justify-end h-full">
            {v > 0 && top.includes(v) && (
              <span className="text-[10px] font-mono mb-1" style={{ color: "var(--text-muted)" }}>
                {format(v)}
              </span>
            )}
            <span className="w-full max-w-[2.75rem] rounded-t" style={{ height: v ? `${(v / max) * 100}%` : 2, background: v ? color : "var(--border)" }} title={`${MONTHS_ES[i]}: ${format(v)}`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-2 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {MONTHS_ES_ABBR.map((m, i) => (
          <span key={m} className="text-[10px] sm:text-[11px] text-center lowercase" style={{ color: i === currentMonth ? "var(--text)" : "var(--text-faint)" }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Calendario tipo GitHub: una columna por semana (de lunes a domingo), color según las páginas. */
function ReadingHeatmap({ calendar, year }) {
  if (!calendar.length) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const known = new Map(calendar.map((c) => [c.date, c]));
  // Todo el año: los días que todavía no llegaron quedan como casilleros vacíos.
  const days = [];
  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const date = `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    days.push(known.get(date) ?? { date, future: true });
  }
  const offset = (new Date(year, 0, 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  // El nombre del mes va en la primera semana que empieza en ese mes.
  let shown = -1;
  const monthStart = weeks.map((w) => {
    const m = Number(w.find(Boolean).date.slice(5, 7)) - 1;
    if (m === shown) return null;
    shown = m;
    return m;
  });
  return (
    <div className="overflow-x-auto thin-scroll pb-1">
      <div className="inline-grid gap-y-1" style={{ gridTemplateColumns: `2rem repeat(${weeks.length}, 13px)`, columnGap: 3 }}>
        <span />
        {monthStart.map((m, i) => (
          <span key={i} className="text-[10px] lowercase whitespace-nowrap" style={{ color: "var(--text-faint)" }}>
            {m != null ? MONTHS_ES_ABBR[m] : ""}
          </span>
        ))}
        {WEEK_LABELS.map((label, row) => (
          <div key={row} className="contents">
            <span className="text-[10px] leading-[13px]" style={{ color: "var(--text-faint)" }}>
              {label}
            </span>
            {weeks.map((w, i) => {
              const c = w[row];
              return <span key={i} className="block rounded-[3px]" style={{ width: 13, height: 13, background: !c || c.future ? "transparent" : HEAT[c.level], border: c?.future ? "1px solid color-mix(in srgb, var(--text) 6%, transparent)" : undefined }} title={c && !c.future ? `${dayMonthYear(c.date)}: ${c.pages} págs` : undefined} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Leés por rachas: enero y febrero no abriste el Kindle, y desde julio casi no paraste." */
function readingInsight(reading, year, today) {
  const lastMonth = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : 11;
  const months = reading.pagesByMonth.slice(0, lastMonth + 1);
  const empty = months.map((p, i) => (p ? null : MONTHS_ES[i])).filter(Boolean);
  if (!reading.daysWithReading) return "Todavía no hay lecturas registradas este año. Importá tus estadísticas de KOReader desde Biblioteca.";
  let streakFrom = null;
  for (let i = months.length - 1; i >= 0 && months[i] > 0; i--) streakFrom = i;
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0]);
  if (empty.length >= 2 && streakFrom != null && months.length - streakFrom >= 3)
    return `Leés por rachas: en ${list(empty)} no abriste el Kindle, y desde ${MONTHS_ES[streakFrom]} casi no paraste.`;
  if (empty.length) return `Leíste ${reading.daysWithReading} de ${reading.daysInPeriod} días; en ${list(empty)} no hubo lectura.`;
  return `Leíste todos los meses: ${reading.daysWithReading} días con lectura en el año.`;
}

function GoalCard({ goal, year, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal?.target ?? 12);
  const save = async (target) => {
    await api.setOcioGoal(year, "book", Number(target) || 0);
    setEditing(false);
    onChanged();
  };
  return (
    <Panel className="lg:border-r lg:border-b">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Meta {year}
        </p>
        {editing ? (
          <form onSubmit={(e) => (e.preventDefault(), save(draft))} className="flex items-center gap-1.5 text-xs">
            <input autoFocus type="number" min="0" value={draft} onChange={(e) => setDraft(e.target.value)} className="w-16 h-8 rounded-md px-2 font-mono" aria-label="Libros por año" />
            <button className="h-8 px-2.5 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              OK
            </button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="hover-surface h-8 px-3 text-xs font-semibold" style={{ border: "1px solid var(--border)" }}>
            {goal ? "Ajustar meta" : "Poner meta"}
          </button>
        )}
      </div>
      {goal ? (
        <>
          <p className="mt-2">
            <span className="font-mono text-5xl font-semibold">{goal.done}</span>
            <span className="text-lg ml-2" style={{ color: "var(--text-muted)" }}>
              de {goal.target} libros
            </span>
          </p>
          <div className="relative rounded-full mt-4" style={{ height: 8, background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
            <div className="h-full rounded-full" style={{ width: `${goal.ratio * 100}%`, background: "var(--ocio-book)" }} />
            {goal.expectedNow != null && <span className="absolute -top-1.5 -bottom-1.5 rounded-full" style={{ left: `${Math.min(1, goal.expectedNow / goal.target) * 100}%`, width: 2, background: "var(--text)" }} />}
          </div>
          <div className="flex justify-between gap-3 text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            <span>{Math.round(goal.ratio * 100)}% hecho</span>
            {goal.expectedNow != null && <span>La marca es dónde «tendrías que ir» hoy: {goal.expectedNow}</span>}
          </div>
          {goal.projected != null && goal.done < goal.target && (
            <div className="rounded-xl px-3.5 py-3 mt-4 text-sm leading-relaxed" style={{ background: "var(--surface-alt)" }}>
              A este ritmo cerrás el año con <b>{goal.projected}</b>.{" "}
              {goal.everyDays && (
                <>
                  Para llegar a {goal.target} tendrías que terminar uno cada <b>{goal.everyDays} días</b>.{" "}
                </>
              )}
              {goal.realistic && (
                <>
                  ¿Bajamos la meta a algo realista, como{" "}
                  <button onClick={() => save(goal.realistic)} className="ghost-action font-semibold px-1 -mx-1" style={{ color: "var(--accent-strong)" }}>
                    {goal.realistic}
                  </button>
                  ?
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
          Poné cuántos libros querés leer este año y te muestro si vas bien.
        </p>
      )}
    </Panel>
  );
}

function BooksTab({ s, year, today, genreLabel, onChanged }) {
  const r = s.reading;
  const [table, setTable] = useState(false);
  const topBucket = [...r.hourBuckets].sort((a, b) => b.share - a.share)[0];
  const nightShare = r.hourBuckets.filter((b) => b.id === "night" || b.id === "late").reduce((x, b) => x + b.share, 0);
  const distinct = s.records.fastest && s.records.slowest && s.records.fastest.entryId !== s.records.slowest.entryId;
  const records = [
    s.records.longest && { key: "longest", label: "El más largo", item: s.records.longest, detail: `${s.records.longest.metadata.pages} págs` },
    distinct && { key: "fastest", label: "El más rápido", item: s.records.fastest, detail: `en ${s.records.fastest.days} días` },
    r.recordDay && { key: "day", label: "Tu día récord", day: r.recordDay, detail: `${r.recordDay.pages} págs${r.recordDay.title ? ` de ${r.recordDay.title}` : ""}` },
    distinct && { key: "slowest", label: "El que más te costó", item: s.records.slowest, detail: `${s.records.slowest.days} días${s.records.slowest.rating ? ` · ${fmt1(s.records.slowest.rating)} estrellas` : ""}` },
  ].filter(Boolean);
  return (
    <>
      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <GoalCard goal={s.goal} year={year} onChanged={onChanged} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-0 lg:border-b lg:[&>*]:border-r lg:[&>*:nth-child(4n)]:border-r-0 lg:[&>*:nth-child(-n+4)]:border-b">
          <Cell label="Páginas leídas" value={r.pages.toLocaleString("es-AR")} sub={r.pages ? `≈ ${Math.max(1, Math.round(r.pages / 320))} libros de 320 págs` : null} />
          <Cell label="Tiempo leyendo" value={r.seconds ? durationText(r.seconds) : "–"} sub="según KOReader" />
          <Cell label="Ritmo" value={r.pagesPerHour} unit={r.pagesPerHour ? "págs/h" : null} sub={r.secondsPerPage ? `≈ ${fmt1(Math.round((r.secondsPerPage / 60) * 10) / 10)} min por página` : null} />
          <Cell label="Racha actual" value={r.currentStreak} unit="días" sub={`Tu mejor: ${r.bestStreak} días`} />
          <Cell label="Días con lectura" value={r.daysWithReading} sub={`de ${r.daysInPeriod} en el año`} />
          <Cell label="Libro promedio" value={s.records.averageDays} unit={s.records.averageDays ? "días" : null} sub="de empezar a terminar" />
          <Cell label="Terminados" value={s.finished} sub={`${s.inProgress} leyendo ahora`} />
          <Cell label="Puntuación promedio" value={s.averageRating != null ? fmt1(s.averageRating) : null} sub={s.want ? `${s.want} en tu lista` : null} />
        </div>
      </div>

      <Panel className="lg:border-b">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[15px] font-semibold">Días que leíste</h2>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Menos
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="inline-block rounded-[3px]" style={{ width: 11, height: 11, background: HEAT[l] }} />
            ))}
            Más
          </span>
        </div>
        <ReadingHeatmap calendar={r.calendar} year={year} />
        <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
          {readingInsight(r, year, today)}
        </p>
      </Panel>

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <Panel className="lg:border-r lg:border-b">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-[15px] font-semibold">Páginas por mes</h2>
            <button onClick={() => setTable((v) => !v)} className="hover-surface flex items-center gap-1.5 h-8 px-3 text-xs font-medium" style={{ border: "1px solid var(--border)" }}>
              <Table2 size={13} />
              {table ? "Ver gráfico" : "Ver como tabla"}
            </button>
          </div>
          {table ? (
            <table className="w-full text-sm">
              <tbody>
                {r.pagesByMonth.map((p, i) => (
                  <tr key={i} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                    <td className="py-1.5 capitalize">{MONTHS_ES[i]}</td>
                    <td className="py-1.5 text-right font-mono">{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <MonthColumns values={r.pagesByMonth} color="var(--ocio-book)" currentMonth={Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : -1} />
          )}
        </Panel>
        <Panel className="lg:border-b">
          <h2 className="text-[15px] font-semibold">¿Cuándo leés?</h2>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-faint)" }}>
            Por la hora en que empieza cada sesión
          </p>
          <ul className="space-y-3">
            {r.hourBuckets.map((b) => (
              <li key={b.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                <span className="text-sm leading-tight">
                  {b.label}
                  <span className="block text-[10px] font-mono" style={{ color: "var(--text-faint)" }}>
                    {b.from}–{b.to}
                  </span>
                </span>
                <span className="rounded-full overflow-hidden" style={{ height: 8, background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${b.share * 100}%`, background: "var(--ocio-book)" }} />
                </span>
                <span className="font-mono text-xs text-right">{Math.round(b.share * 100)}%</span>
              </li>
            ))}
          </ul>
          {r.sessions > 0 && (
            <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
              {nightShare >= 0.5 ? (
                <>
                  Sos lector nocturno: <b>{Math.round(nightShare * 10)} de cada 10</b> sesiones arrancan de noche o de madrugada.
                </>
              ) : (
                <>
                  Leés más a la <b>{topBucket.label.toLowerCase()}</b> ({Math.round(topBucket.share * 100)}% de las sesiones).
                </>
              )}
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel className="lg:border-r">
          <h2 className="text-[15px] font-semibold mb-4">Géneros que leíste</h2>
          {s.genres.length ? <Bars rows={s.genres.map((g) => ({ key: g.id, label: genreLabel(g.id), value: g.count }))} /> : <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargá géneros en tus libros.</p>}
          <p className="text-[11px] mt-4" style={{ color: "var(--text-faint)" }}>
            Cuenta los {s.touched} libros que tocaste este año, terminados o en curso. Un libro puede tener más de un género.
          </p>
        </Panel>
        <Panel>
          <h2 className="text-[15px] font-semibold mb-4">Récords del año</h2>
          {records.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {records.map((rec) => (
                <div key={rec.key} className="flex items-center gap-3 rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
                  {rec.item ? (
                    <Link to={`/ocio/obra/${rec.item.entryId}`}>
                      <WorkCover item={{ title: rec.item.title, cover: rec.item.cover, type: "book" }} size="thumb" />
                    </Link>
                  ) : (
                    <span className="flex items-center justify-center w-10 h-14 rounded-md shrink-0" style={{ background: "var(--surface-alt)", color: "var(--ocio-book)" }}>
                      <Flame size={16} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {rec.label}
                    </p>
                    <p className="text-sm font-semibold truncate">{rec.item ? rec.item.title : dayMonthYear(rec.day.date).slice(0, -5)}</p>
                    <p className="text-[11px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                      {rec.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Cuando termines libros con fecha de inicio y fin aparecen tus récords.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}

function TypeTab({ s, type, today, year, genreLabel }) {
  const t = WORK_TYPES[type];
  return (
    <>
      <section className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:gap-0 lg:border-b lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 mb-4 lg:mb-0">
        <Cell label={type === "movie" ? "Vistas" : "Terminados"} value={s.finished} sub={`${fmt1(s.perMonth)} por mes`} />
        <Cell label={type === "game" ? "Horas jugadas" : "Horas"} value={s.hours || "–"} sub={type === "movie" ? "según la duración de cada una" : type === "game" ? "de los juegos terminados" : null} />
        <Cell label="Puntuación promedio" value={s.averageRating != null ? fmt1(s.averageRating) : null} />
        <Cell label="En curso · en tu lista" value={`${s.inProgress} · ${s.want}`} />
      </section>
      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <Panel className="lg:border-r lg:border-b">
          <h2 className="text-[15px] font-semibold mb-4">Terminados por mes</h2>
          <MonthColumns values={s.monthly} color={t.color} currentMonth={Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : -1} />
        </Panel>
        <Panel className="lg:border-b">
          <h2 className="text-[15px] font-semibold mb-4">Géneros</h2>
          {s.genres.length ? <Bars rows={s.genres.map((g) => ({ key: g.id, label: genreLabel(g.id), value: g.count }))} color={t.color} /> : <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin datos todavía.</p>}
        </Panel>
        <Panel className="lg:border-r">
          <h2 className="text-[15px] font-semibold mb-4">Lo mejor del año</h2>
          {s.best.length ? (
            <ul className="space-y-3">
              {s.best.map((b) => (
                <li key={b.entryId}>
                  <Link to={`/ocio/obra/${b.entryId}`} className="flex items-center gap-3">
                    <WorkCover item={{ title: b.title, cover: b.cover, type }} size="thumb" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{b.title}</span>
                      <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
                        {dayMonthYear(b.date)}
                      </span>
                    </span>
                    <Stars value={b.rating} size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Puntuá lo que terminás para ver tus favoritos.
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="text-[15px] font-semibold mb-4">{t.creator === "Autor" ? "Autores" : t.creator === "Estudio" ? "Estudios" : "Directores y creadores"}</h2>
          {s.topCreators.length ? <Bars rows={s.topCreators.map((c) => ({ key: c.name, label: c.name, value: c.count }))} color={t.color} /> : <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin datos todavía.</p>}
        </Panel>
      </div>
    </>
  );
}

function GeneralTab({ s, today, year, genreLabel }) {
  return (
    <>
      <section className="grid gap-3 grid-cols-2 sm:grid-cols-5 lg:gap-0 lg:border-b lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 mb-4 lg:mb-0">
        <Cell label="Terminados" value={s.totalFinished} sub={`en ${year}`} />
        {TYPE_ORDER.map((t) => (
          <Cell key={t} label={WORK_TYPES[t].plural} value={s.finishedCount[t]} />
        ))}
      </section>
      <Panel className="lg:border-b">
        <h2 className="text-[15px] font-semibold mb-4">Terminados por mes</h2>
        <MonthlyBlocks months={s.monthly} currentMonth={Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : -1} />
      </Panel>
      <div className="grid gap-4 lg:gap-0 lg:grid-cols-2">
        <Panel className="lg:border-r">
          <h2 className="text-[15px] font-semibold mb-4">Géneros</h2>
          {s.genres.length ? <Bars rows={s.genres.map((g) => ({ key: g.id, label: genreLabel(g.id), value: g.count }))} /> : <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sin datos todavía.</p>}
          {s.averageRating != null && (
            <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
              Puntuación promedio: <b className="font-mono">{fmt1(s.averageRating)}</b>
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="text-[15px] font-semibold mb-4">
            Salidas por mes <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>{s.outingsCount}</span>
          </h2>
          <MonthColumns values={s.outingsMonthly} color="var(--accent)" currentMonth={Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : -1} />
        </Panel>
      </div>
    </>
  );
}

function KoreaderPill() {
  const statusApi = useApi(() => api.getKoreaderStatus(), []);
  const s = statusApi.data;
  if (!s) return null;
  const when = s.lastImportAt ? new Date(s.lastImportAt) : null;
  const days = when ? Math.floor((Date.now() - when.getTime()) / 86_400_000) : null;
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }} title={s.sessions ? `${s.sessions} sesiones de ${s.linkedBooks} libros` : undefined}>
      <RefreshCw size={13} />
      {when ? `KOReader sincronizado ${days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`}` : "KOReader sin importar"}
    </span>
  );
}

export function Estadisticas() {
  const { version, genreLabel, bump } = useOcio();
  const today = todayDateInputValue();
  const currentYear = Number(today.slice(0, 4));
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get("tipo")) ? params.get("tipo") : "general";
  const year = Number(params.get("anio")) || currentYear;
  const statsApi = useApi(() => api.getOcioStats(year, tab === "general" ? undefined : tab), [year, tab, version]);
  const set = (k, v) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: true }
    );
  const s = statsApi.data;

  return (
    <PageTransition>
      <PageBar crumb="Ocio · Analizar" title="Estadísticas">
        <KoreaderPill />
        <Link to={`/ocio/resumen${year === currentYear ? "" : `?anio=${year}`}`} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm font-semibold" style={{ border: "1px solid var(--border)" }}>
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          Resumen {year}
        </Link>
        <YearToggle years={[currentYear - 1, currentYear]} value={year} onChange={(y) => set("anio", y === currentYear ? "" : String(y))} />
      </PageBar>
      <nav className="no-scrollbar flex gap-6 overflow-x-auto px-4 lg:px-7 max-lg:-mx-4" style={{ borderBottom: "1px solid var(--border)" }} aria-label="Tipo">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => set("tipo", id === "general" ? "" : id)} aria-current={tab === id ? "page" : undefined} className="py-3 text-sm whitespace-nowrap -mb-px" style={{ color: tab === id ? "var(--text)" : "var(--text-muted)", fontWeight: tab === id ? 600 : 500, borderBottom: `2px solid ${tab === id ? "var(--accent)" : "transparent"}` }}>
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-4 lg:mt-0 space-y-4 lg:space-y-0">
        {s && s.type === (tab === "general" ? "general" : tab) && (tab === "book" ? <BooksTab s={s} year={year} today={today} genreLabel={genreLabel} onChanged={() => (bump(), statsApi.reload())} /> : tab === "general" ? <GeneralTab s={s} today={today} year={year} genreLabel={genreLabel} /> : <TypeTab s={s} type={tab} today={today} year={year} genreLabel={genreLabel} />)}
      </div>
    </PageTransition>
  );
}
