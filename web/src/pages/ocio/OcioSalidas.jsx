import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Link2, Loader2, MapPin, Pencil, Plus, Sparkles, Trash2, Users, X } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { OutingFormModal } from "../../components/ocio/OutingFormModal.jsx";
import { GoogleSyncPill } from "../../components/ocio/GoogleSyncPill.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { currency, todayDateInputValue } from "../../lib/format.js";
import { MONTHS_ES } from "../../lib/billing.js";
import { OUTING_CATEGORIES, OUTING_STATUS, categoryInfo, dateTile, dayMonthYear, longDate, relativeDays, shortDay } from "../../lib/ocio/outings.js";
import { useOcio } from "./OcioContext.jsx";

const pad = (n) => String(n).padStart(2, "0");
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const money = (n) => currency.format(Math.round(n || 0));
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const addMonths = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};
const planned = (o) => o.status === "tentative" || o.status === "confirmed";

function Kpi({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 p-4 lg:px-6 lg:py-5 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] ${className}`}>
      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Carga rápida: "recital en Quality el sábado 14 a las 21" → vista previa → guardar. */
function QuickAdd({ onCreate, onAdjust }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (text.trim().length < 3) return setPreview(null);
    const timer = setTimeout(() => {
      api
        .parseOuting(text)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);

  async function save(e) {
    e?.preventDefault();
    if (!preview?.date || busy) return;
    setBusy(true);
    try {
      await onCreate({ ...preview, status: "confirmed" });
      setText("");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const cat = categoryInfo(preview?.category);
  return (
    <form onSubmit={save} className="rounded-xl" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 pl-3.5 pr-1.5 h-12">
        <Sparkles size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. recital en Quality el sábado 14 a las 21" aria-label="Carga rápida de una salida" className="flex-1 min-w-0 h-10 text-sm" style={{ border: 0, background: "transparent", outline: "none" }} />
        <button type="submit" disabled={!preview?.date || busy} className="hover-surface h-9 px-3 text-sm font-semibold disabled:opacity-40" style={{ background: "var(--surface-alt)" }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : "Agregar"}
        </button>
      </div>
      {preview && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            {preview.title}
          </span>
          <span style={{ color: preview.date ? "var(--text-muted)" : "var(--status-warning)" }}>{preview.date ? cap(shortDay(preview.date)) : "¿Qué día? Escribilo (ej. el sábado, 14/11)"}</span>
          {preview.startTime && <span style={{ color: "var(--text-muted)" }}>{preview.startTime}</span>}
          {preview.place && <span style={{ color: "var(--text-muted)" }}>en {preview.place}</span>}
          {preview.withWhom && <span style={{ color: "var(--text-muted)" }}>con {preview.withWhom}</span>}
          {cat && (
            <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: cat.color }} />
              {cat.label}
            </span>
          )}
          <button type="button" onClick={() => onAdjust(preview)} className="ghost-action ml-auto font-semibold px-1.5 py-0.5" style={{ color: "var(--accent-strong)" }}>
            Ajustar
          </button>
          {preview.warnings?.map((w) => (
            <p key={w} className="basis-full flex items-center gap-1.5" style={{ color: "var(--status-warning)" }}>
              <AlertTriangle size={12} />
              {w}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}

/** Calendario del mes (lunes a domingo) con las salidas de cada día. */
function MonthGrid({ month, outings, today, selectedId, onSelect, onNewOn }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Math.ceil((offset + new Date(y, m, 0).getDate()) / 7) * 7;
  const byDate = useMemo(() => {
    const map = new Map();
    for (const o of outings) map.set(o.date, [...(map.get(o.date) || []), o]);
    return map;
  }, [outings]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-7 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)", background: "var(--surface-alt)" }}>
        {WEEK.map((d) => (
          <span key={d} className="px-2 py-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: cells }, (_, i) => {
          const d = new Date(y, m - 1, i - offset + 1);
          const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const inMonth = d.getMonth() === m - 1;
          const list = byDate.get(key) || [];
          const isToday = key === today;
          return (
            <div key={key} className="min-h-[4.5rem] sm:min-h-[6.25rem] p-1 sm:p-1.5 flex flex-col gap-1 min-w-0" style={{ borderTop: "1px solid var(--border)", borderLeft: i % 7 ? "1px solid var(--border)" : undefined, background: inMonth ? undefined : "color-mix(in srgb, var(--text) 3%, transparent)" }}>
              <button
                type="button"
                onClick={() => onNewOn(key)}
                title={`Nueva salida el ${dayMonthYear(key)}`}
                className="self-start flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-mono font-semibold"
                style={isToday ? { background: "var(--accent)", color: "var(--on-accent)" } : { color: inMonth ? "var(--text-muted)" : "var(--text-faint)" }}
              >
                {d.getDate()}
              </button>
              {list.slice(0, 3).map((o) => {
                const cat = categoryInfo(o.category);
                const selected = o.id === selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onSelect(o.id)}
                    title={o.title}
                    className="flex items-center gap-1 rounded-md px-1.5 h-6 text-[11px] font-semibold min-w-0 text-left"
                    style={{
                      border: `1px solid ${selected ? "color-mix(in srgb, var(--accent) 60%, var(--border))" : "var(--border)"}`,
                      background: selected ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface)",
                      opacity: o.status === "not_attended" ? 0.5 : 1,
                      textDecoration: o.status === "not_attended" ? "line-through" : undefined,
                    }}
                  >
                    <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, background: cat?.color ?? "var(--text-faint)" }} />
                    <span className="truncate">{o.title}</span>
                  </button>
                );
              })}
              {list.length > 3 && (
                <span className="text-[10px] px-1" style={{ color: "var(--text-faint)" }}>
                  +{list.length - 3} más
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({ outings, today, selectedId, onSelect }) {
  if (!outings.length)
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        No hay salidas este mes.
      </p>
    );
  return (
    <ul className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {outings.map((o, i) => {
        const tile = dateTile(o.date);
        const cat = categoryInfo(o.category);
        return (
          <li key={o.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
            <button type="button" onClick={() => onSelect(o.id)} className="movement-row w-full flex items-center gap-3 px-3 py-2.5 text-left" style={{ background: o.id === selectedId ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined }}>
              <span className="flex flex-col items-center justify-center rounded-lg shrink-0 w-11 h-12" style={{ border: "1px solid var(--border)" }}>
                <span className="text-[9px] font-semibold tracking-wider" style={{ color: "var(--ocio-movie)" }}>
                  {tile.month}
                </span>
                <span className="font-mono text-lg leading-none font-semibold">{tile.day}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{o.title}</span>
                <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                  {[cap(shortDay(o.date)), o.startTime, o.place, cat?.label, relativeDays(o.date, today)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
                {OUTING_STATUS[o.status].label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Gastos vinculados a la salida + buscar candidatos (día ±1 o que la mencionan) para vincular. */
function LinkedExpenses({ outing, onChanged }) {
  const linkedApi = useApi(() => api.getOutingExpenses(outing.id), [outing.id, outing.spent]);
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const linked = linkedApi.data || [];
  const total = linked.reduce((s, e) => s + e.amount, 0);

  async function openPicker() {
    setPicking(true);
    setCandidates(null);
    setCandidates(await api.getOutingCandidates(outing.id).catch(() => []));
  }
  async function link(expenseId) {
    await api.linkOutingExpense(outing.id, expenseId);
    setCandidates((c) => c.filter((e) => e.id !== expenseId));
    linkedApi.reload();
    onChanged();
  }
  async function unlink(expenseId) {
    await api.unlinkOutingExpense(outing.id, expenseId);
    linkedApi.reload();
    onChanged();
  }

  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
        Gastos vinculados
      </p>
      {linked.length === 0 ? (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Todavía nada. Cuando cargues un gasto en esa fecha te vamos a preguntar si va acá.
        </p>
      ) : (
        <ul className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {linked.map((e, i) => (
            <li key={e.id} className="movement-row flex items-center gap-2 px-3 py-2 text-sm" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.title}</span>
                <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {dayMonthYear(e.date)}
                </span>
              </span>
              <span className="font-mono text-xs font-semibold">{money(e.amount)}</span>
              <button onClick={() => unlink(e.id)} aria-label={`Desvincular ${e.title}`} className="row-actions hover-surface w-7 h-7 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
                <X size={13} />
              </button>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2 text-xs font-semibold" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
            <span>Total</span>
            <span className="font-mono">{money(total)}</span>
          </li>
        </ul>
      )}
      {!picking ? (
        <button onClick={openPicker} className="hover-surface flex items-center gap-1.5 h-8 px-3 mt-2.5 text-xs font-semibold" style={{ border: "1px dashed var(--border)" }}>
          <Link2 size={13} />
          Vincular gasto
        </button>
      ) : (
        <div className="mt-2.5 rounded-lg p-2" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Gastos de esos días o que la mencionan
            </span>
            <button onClick={() => setPicking(false)} aria-label="Cerrar" className="hover-surface w-6 h-6 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
              <X size={12} />
            </button>
          </div>
          {candidates == null ? (
            <Loader2 size={14} className="animate-spin m-2" />
          ) : candidates.length === 0 ? (
            <p className="text-xs px-1 py-2" style={{ color: "var(--text-faint)" }}>
              No hay gastos cerca de esa fecha. Cargalos en Finanzas y volvé.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto thin-scroll">
              {candidates.map((e) => (
                <li key={e.id}>
                  <button onClick={() => link(e.id)} className="card-hover w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.title}</span>
                      <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                        {[dayMonthYear(e.date), e.description, e.reason === "texto" ? "la menciona" : null, e.linkedTo ? `ya está en «${e.linkedTo}»` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="font-mono text-xs">{money(e.amount)}</span>
                    <Plus size={14} style={{ color: "var(--accent)" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function OutingDetail({ outing, onEdit, onDelete, onStatus, onChanged }) {
  const cat = categoryInfo(outing.category);
  const time = outing.startTime ? `${outing.startTime}${outing.endTime ? `–${outing.endTime}` : ""}` : "sin horario";
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {cat && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: cat.color }}>
              <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: cat.color }} />
              {cat.label}
            </span>
          )}
          <h2 className="font-serif text-[1.75rem] leading-tight mt-0.5 break-words">{outing.title}</h2>
        </div>
        <button onClick={onEdit} aria-label="Editar salida" className="hover-surface w-8 h-8 flex items-center justify-center shrink-0" style={{ color: "var(--text-muted)" }}>
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} aria-label="Borrar salida" className="hover-surface w-8 h-8 flex items-center justify-center shrink-0" style={{ color: "var(--text-muted)" }}>
          <Trash2 size={14} />
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2.5">
          <CalendarDays size={15} style={{ color: "var(--text-faint)" }} />
          {cap(longDate(outing.date))} · <span style={{ color: "var(--text-muted)" }}>{time}</span>
        </li>
        <li className="flex items-center gap-2.5" style={{ color: outing.place ? undefined : "var(--text-faint)" }}>
          <MapPin size={15} style={{ color: "var(--text-faint)" }} />
          {outing.place || "Sin lugar"}
        </li>
        <li className="flex items-center gap-2.5" style={{ color: outing.withWhom ? undefined : "var(--text-faint)" }}>
          <Users size={15} style={{ color: "var(--text-faint)" }} />
          {outing.withWhom || "Sin indicar"}
        </li>
      </ul>
      <div>
        <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
          Estado
        </p>
        <div className="grid grid-cols-4 rounded-xl p-1 gap-1" style={{ background: "var(--surface-alt)" }}>
          {Object.entries(OUTING_STATUS).map(([id, s]) => (
            <button key={id} onClick={() => onStatus(id)} aria-pressed={outing.status === id} className="h-8 rounded-lg text-xs truncate px-1" style={{ background: outing.status === id ? "var(--surface)" : "transparent", fontWeight: outing.status === id ? 600 : 500, color: outing.status === id ? "var(--text)" : "var(--text-muted)" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <LinkedExpenses outing={outing} onChanged={onChanged} />
      {outing.notes && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {outing.notes}
        </p>
      )}
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {outing.source === "google" ? "Viene de Google Calendar" : outing.googleEventId ? "Creada acá · copiada a Google Calendar" : "Creada acá"}
      </p>
    </div>
  );
}

export function OcioSalidas() {
  const { bump } = useOcio();
  const today = todayDateInputValue();
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("mes") || "") ? params.get("mes") : today.slice(0, 7);
  const view = params.get("vista") === "agenda" ? "agenda" : "month";
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null); // null | { initial }
  const outingsApi = useApi(() => api.getOutings(), [version]);
  const summaryApi = useApi(() => api.getOutingsSummary(month), [month, version]);

  const all = outingsApi.data || [];
  const ofMonth = all.filter((o) => o.date.startsWith(month));
  const s = summaryApi.data;
  // Selección por defecto: la próxima salida de este mes o, si no hay, la primera del mes.
  const selected = all.find((o) => o.id === selectedId) ?? ofMonth.find((o) => o.date >= today && planned(o)) ?? ofMonth[0] ?? null;

  const refresh = () => {
    setVersion((v) => v + 1);
    bump();
  };
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

  async function create(data) {
    const created = await api.addOuting({ title: data.title, date: data.date, startTime: data.startTime, place: data.place, withWhom: data.withWhom, category: data.category, status: data.status ?? "confirmed" });
    setSelectedId(created.id);
    setParam("mes", created.date.slice(0, 7) === today.slice(0, 7) ? "" : created.date.slice(0, 7));
    refresh();
  }
  async function setStatus(o, status) {
    await api.updateOuting(o.id, { status });
    refresh();
  }
  async function remove(o) {
    if (!window.confirm(`¿Borrar “${o.title}”?`)) return;
    await api.deleteOuting(o.id);
    setSelectedId(null);
    refresh();
  }

  const [y, m] = month.split("-").map(Number);
  const monthName = cap(MONTHS_ES[m - 1]);

  return (
    <PageTransition>
      <PageBar crumb="Ocio · Agenda" title="Salidas">
        <GoogleSyncPill onSynced={refresh} />
        <button onClick={() => setForm({ initial: {} })} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={16} />
          Nueva salida
        </button>
      </PageBar>

      {s && (
        <section aria-label="Números de salidas" className="grid gap-3 grid-cols-2 xl:grid-cols-4 lg:gap-0 lg:border-b mb-4 lg:mb-0 lg:[&>*]:border-r xl:[&>*:last-child]:border-r-0 lg:max-xl:[&>*:nth-child(-n+2)]:border-b">
          <Kpi label={`Salidas en ${s.year}`}>
            <p className="font-mono text-2xl font-semibold">{s.yearCount}</p>
          </Kpi>
          <Kpi label={`En ${MONTHS_ES[m - 1]}`}>
            <p className="font-mono text-2xl font-semibold">{s.monthCount}</p>
          </Kpi>
          <Kpi label={`Gastado en salidas · ${MONTHS_ES[m - 1].slice(0, 3)}`}>
            <p className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-2xl font-semibold">{money(s.monthSpent)}</span>
              <Link to="/gastos" className="ghost-action text-xs font-semibold px-1 -mx-1" style={{ color: "var(--accent-strong)" }}>
                en Finanzas
              </Link>
            </p>
          </Kpi>
          <Kpi label="Lo que más hacés">
            {s.topCategory ? (
              <p className="flex items-center gap-2">
                <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: categoryInfo(s.topCategory.id)?.color }} />
                <span className="text-lg font-semibold">{categoryInfo(s.topCategory.id)?.label}</span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  · {s.topCategory.count} de {s.topCategory.of}
                </span>
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                Todavía sin datos
              </p>
            )}
          </Kpi>
        </section>
      )}

      <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="p-0 lg:p-6 lg:border-r min-w-0 space-y-4">
          <QuickAdd onCreate={create} onAdjust={(preview) => setForm({ initial: preview })} />
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold mr-1">
              {monthName} <span className="font-mono text-sm font-normal" style={{ color: "var(--text-faint)" }}>{y}</span>
            </h2>
            <button onClick={() => setParam("mes", addMonths(month, -1))} aria-label="Mes anterior" className="hover-surface w-8 h-8 flex items-center justify-center">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setParam("mes", addMonths(month, 1))} aria-label="Mes siguiente" className="hover-surface w-8 h-8 flex items-center justify-center">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setParam("mes", "")} className="hover-surface h-8 px-3 text-xs font-semibold" style={{ border: "1px solid var(--border)" }}>
              Hoy
            </button>
            <div className="hidden md:flex flex-wrap items-center gap-x-3 ml-auto mr-2">
              {Object.entries(OUTING_CATEGORIES)
                .filter(([id]) => ofMonth.some((o) => o.category === id))
                .map(([id, c]) => (
                  <span key={id} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: c.color }} />
                    {c.label}
                  </span>
                ))}
            </div>
            <div className="flex rounded-lg p-0.5 max-md:ml-auto" style={{ border: "1px solid var(--border)" }} role="tablist" aria-label="Vista">
              {[
                ["month", "Mes"],
                ["agenda", "Agenda"],
              ].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={view === id} onClick={() => setParam("vista", id === "agenda" ? "agenda" : "")} className="h-7 px-3 rounded-md text-xs" style={{ background: view === id ? "var(--surface-alt)" : "transparent", fontWeight: view === id ? 600 : 500, color: view === id ? "var(--text)" : "var(--text-muted)" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {view === "month" ? (
            <MonthGrid month={month} outings={all} today={today} selectedId={selected?.id} onSelect={setSelectedId} onNewOn={(date) => setForm({ initial: { date } })} />
          ) : (
            <AgendaList outings={ofMonth} today={today} selectedId={selected?.id} onSelect={setSelectedId} />
          )}
        </section>

        <aside className="min-w-0 max-lg:space-y-4">
          <div className="p-4 sm:p-5 lg:p-6 lg:border-b max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)]">
            {selected ? (
              <OutingDetail key={selected.id} outing={selected} onEdit={() => setForm({ initial: selected })} onDelete={() => remove(selected)} onStatus={(st) => setStatus(selected, st)} onChanged={refresh} />
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Elegí una salida del calendario o tocá un día para crear una.
              </p>
            )}
          </div>

          {s?.unconfirmed.length > 0 && (
            <div className="p-4 sm:p-5 lg:p-6 lg:border-b max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)]">
              <h3 className="text-[15px] font-semibold">¿Fuiste?</h3>
              <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-faint)" }}>
                Ya pasaron y siguen sin confirmar.
              </p>
              <ul className="space-y-3">
                {s.unconfirmed.map((o) => (
                  <li key={o.id} className="flex items-center gap-2.5">
                    <span className="inline-block rounded-full shrink-0" style={{ width: 7, height: 7, background: categoryInfo(o.category)?.color ?? "var(--text-faint)" }} />
                    <button onClick={() => setSelectedId(o.id)} className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold truncate">{o.title}</span>
                      <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                        {[cap(shortDay(o.date)), o.place].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                    <button onClick={() => setStatus(o, "attended")} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold shrink-0" style={{ background: "color-mix(in srgb, var(--status-good) 16%, transparent)", color: "var(--status-good)" }}>
                      <Check size={13} />
                      Fui
                    </button>
                    <button onClick={() => setStatus(o, "not_attended")} className="hover-surface h-8 px-2.5 text-xs shrink-0" style={{ border: "1px solid var(--border)" }}>
                      No fui
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s?.upcoming.length > 0 && (
            <div className="p-4 sm:p-5 lg:p-6 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)]">
              <h3 className="text-[15px] font-semibold mb-3">Próximas</h3>
              <ul className="space-y-3">
                {s.upcoming.map((o) => {
                  const tile = dateTile(o.date);
                  return (
                    <li key={o.id}>
                      <button onClick={() => (setSelectedId(o.id), setParam("mes", o.date.slice(0, 7) === today.slice(0, 7) ? "" : o.date.slice(0, 7)))} className="flex items-center gap-3 text-left w-full">
                        <span className="flex flex-col items-center justify-center rounded-lg shrink-0 w-11 h-12" style={{ border: "1px solid var(--border)" }}>
                          <span className="text-[9px] font-semibold tracking-wider" style={{ color: "var(--accent-strong)" }}>
                            {tile.month}
                          </span>
                          <span className="font-mono text-lg leading-none font-semibold">{tile.day}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{o.title}</span>
                          <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
                            {relativeDays(o.date, today)} · {OUTING_STATUS[o.status].label}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {form && <OutingFormModal initial={form.initial} onClose={() => setForm(null)} onSaved={(saved) => (setSelectedId(saved.id), refresh())} />}
    </PageTransition>
  );
}
