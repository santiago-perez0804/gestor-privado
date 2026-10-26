import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { DateField } from "../../components/common/DateField.jsx";
import { Panel, SectionTitle } from "../../components/ocio/bits.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { todayDateInputValue } from "../../lib/format.js";
import { OUTING_CATEGORIES, OUTING_STATUS, categoryInfo, dateTile, relativeDays, weekdayName } from "../../lib/ocio/outings.js";
import { useOcio } from "./OcioContext.jsx";

const field = "h-10 rounded-lg px-3 text-sm min-w-0";

function OutingForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayDateInputValue());
  const [startTime, setStartTime] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("confirmed");
  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd({ title, date, startTime: startTime || null, place: place || null, category: category || null, status });
    setTitle("");
    setStartTime("");
    setPlace("");
    setCategory("");
  }
  return (
    <form onSubmit={submit} className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_7rem_1.5fr_1fr_1fr_auto] items-end">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Qué (ej. recital en Quality)" className={field} aria-label="Título" />
      <DateField value={date} onChange={setDate} />
      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} aria-label="Hora" />
      <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Dónde" className={field} aria-label="Lugar" />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={field} aria-label="Categoría">
        <option value="">Categoría</option>
        {Object.entries(OUTING_CATEGORIES).map(([id, c]) => (
          <option key={id} value={id}>
            {c.label}
          </option>
        ))}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={field} aria-label="Estado">
        <option value="tentative">Tentativo</option>
        <option value="confirmed">Confirmado</option>
      </select>
      <button type="submit" disabled={!title.trim()} className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        <Plus size={16} />
        Agregar
      </button>
    </form>
  );
}

function OutingRow({ outing, today, onUpdate, onDelete }) {
  const tile = dateTile(outing.date);
  const cat = categoryInfo(outing.category);
  const past = outing.date < today;
  const pending = outing.status === "tentative" || outing.status === "confirmed";
  return (
    <li className="movement-row flex items-center gap-3 px-4 lg:px-7 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="flex flex-col items-center justify-center rounded-lg shrink-0 w-11 h-12" style={{ border: "1px solid var(--border)" }}>
        <span className="text-[9px] font-semibold tracking-wider" style={{ color: "var(--ocio-movie)" }}>
          {tile.month}
        </span>
        <span className="font-mono text-lg leading-none font-semibold">{tile.day}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {cat && <span className="inline-block rounded-full mr-1.5 align-middle" style={{ width: 6, height: 6, background: cat.color }} />}
          {outing.title}
        </p>
        <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
          {[weekdayName(outing.date), outing.startTime, outing.place, cat?.label, relativeDays(outing.date, today)].filter(Boolean).join(" · ")}
        </p>
      </div>
      {past && pending ? (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => onUpdate(outing.id, { status: "attended" })} className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--status-good) 16%, transparent)", color: "var(--status-good)" }}>
            <Check size={13} />
            Fui
          </button>
          <button onClick={() => onUpdate(outing.id, { status: "not_attended" })} className="hover-surface flex items-center gap-1 h-8 px-2.5 text-xs" style={{ border: "1px solid var(--border)" }}>
            <X size={13} />
            No fui
          </button>
        </div>
      ) : (
        <select value={outing.status} onChange={(e) => onUpdate(outing.id, { status: e.target.value })} className="h-8 rounded-lg px-2 text-xs shrink-0" aria-label="Estado">
          {Object.entries(OUTING_STATUS).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <span className="row-actions">
        <button onClick={() => window.confirm(`¿Borrar “${outing.title}”?`) && onDelete(outing.id)} aria-label="Borrar salida" className="hover-surface w-8 h-8 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
          <Trash2 size={14} />
        </button>
      </span>
    </li>
  );
}

export function OcioSalidas() {
  const { bump } = useOcio();
  const outingsApi = useApi(() => api.getOutings(), []);
  const today = todayDateInputValue();
  const outings = outingsApi.data || [];
  const upcoming = outings.filter((o) => o.date >= today);
  const past = outings.filter((o) => o.date < today).reverse();

  async function add(data) {
    const created = await api.addOuting(data);
    outingsApi.setData((prev) => [...(prev || []), created].sort((a, b) => a.date.localeCompare(b.date)));
    bump();
  }
  async function update(id, data) {
    const updated = await api.updateOuting(id, data);
    outingsApi.setData((prev) => prev.map((o) => (o.id === id ? updated : o)));
    bump();
  }
  async function remove(id) {
    await api.deleteOuting(id);
    outingsApi.setData((prev) => prev.filter((o) => o.id !== id));
    bump();
  }

  return (
    <PageTransition>
      <PageBar crumb="Ocio · Agenda" title="Salidas" />
      <Panel className="lg:border-b">
        <OutingForm onAdd={add} />
      </Panel>
      {[
        ["Próximas", upcoming],
        ["Pasadas", past],
      ].map(([title, list]) =>
        list.length ? (
          <section key={title} className="mt-4 lg:mt-0 max-lg:rounded-2xl max-lg:border max-lg:bg-[var(--surface)] max-lg:overflow-hidden">
            <div className="px-4 lg:px-7 pt-5 pb-1">
              <SectionTitle count={list.length}>{title}</SectionTitle>
            </div>
            <ul style={{ borderTop: "1px solid var(--border)" }}>
              {list.map((o) => (
                <OutingRow key={o.id} outing={o} today={today} onUpdate={update} onDelete={remove} />
              ))}
            </ul>
          </section>
        ) : null
      )}
    </PageTransition>
  );
}
