import { BookOpen } from "lucide-react";
import { dayMonthYear, durationText } from "../../lib/ocio/outings.js";

const CONFIDENCE = { linked: "Ya vinculado", exact: "Coincide" };

/**
 * Lista de libros de KOReader con un selector "¿a qué libro de tu biblioteca va?".
 * mode "import": agregar / no importar esta vez · mode "pending": agregar / ignorar siempre.
 */
export function KoreaderBookRows({ books, library, mapping, onChange, mode = "import" }) {
  return (
    <div className="thin-scroll max-h-[26rem] overflow-y-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
      {books.map((b, i) => (
        <div key={b.key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] items-center px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
          <div className="min-w-0 flex gap-3">
            <BookOpen size={16} className="shrink-0 mt-0.5" style={{ color: "var(--ocio-book)" }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{b.title}</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                {[b.authors?.replace(/\n/g, ", "), b.sessionCount != null && `${b.sessionCount} sesiones`, b.totalSeconds ? durationText(b.totalSeconds) : null, b.lastRead && `última ${dayMonthYear(b.lastRead)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={mapping[b.key]} onChange={(e) => onChange(b.key, e.target.value)} className="h-9 rounded-lg px-2 text-sm flex-1 min-w-0" aria-label={`A qué libro va ${b.title}`}>
              <option value="new">Agregar a la biblioteca</option>
              {mode === "pending" ? <option value="ignore">Ignorar siempre</option> : <option value="skip">No importar</option>}
              <optgroup label="Tus libros">
                {library.map((lb) => (
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
  );
}
