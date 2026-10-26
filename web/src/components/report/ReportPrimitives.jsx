// Piezas del informe mensual. Gráficos hechos con CSS (sin recharts): se imprimen igual que en pantalla.
import { currency } from "../../lib/format.js";

export const money = (x) => currency.format(Math.round(x || 0));
export const pct = (x, digits = 0) => `${((x || 0) * 100).toFixed(digits).replace(".", ",")}%`;
export const num = (x, digits = 1) => (x || 0).toFixed(digits).replace(".", ",");

export const TONE_COLOR = {
  good: "var(--status-good)",
  info: "var(--chart-cat-1)",
  warn: "var(--status-warning)",
  bad: "var(--status-critical)",
};

export function ReportSection({ n, title, subtitle, breakBefore, children }) {
  return (
    <section className={`mt-9 ${breakBefore ? "report-page-break" : ""}`}>
      <div className="report-heading flex items-baseline gap-2 pb-1.5 mb-4" style={{ borderBottom: "2px solid var(--accent)" }}>
        <span className="font-mono text-xs font-semibold" style={{ color: "var(--accent)" }}>
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && (
          <span className="ml-auto text-[11px] text-right" style={{ color: "var(--text-faint)" }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function SubHeading({ children, aside }) {
  return (
    <div className="report-heading flex items-baseline justify-between gap-2 mt-5 mb-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {aside && (
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          {aside}
        </span>
      )}
    </div>
  );
}

/** Variación porcentual. `goodWhenDown`: en gastos, bajar es bueno (verde). */
export function Delta({ value, goodWhenDown = true, empty = "—" }) {
  if (value == null || !Number.isFinite(value)) return <span style={{ color: "var(--text-faint)" }}>{empty}</span>;
  const flat = Math.abs(value) < 0.05;
  const good = goodWhenDown ? value < 0 : value > 0;
  const color = flat ? "var(--text-faint)" : good ? "var(--status-good)" : "var(--status-warning)";
  return (
    <span className="font-mono tabular-nums whitespace-nowrap" style={{ color }}>
      {flat ? "≈" : value > 0 ? "▲" : "▼"} {pct(Math.abs(value))}
    </span>
  );
}

export function Kpi({ label, value, sub, accent }) {
  return (
    <div className="report-keep rounded-xl px-3 py-2.5" style={{ background: "var(--surface-alt)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="font-mono text-lg font-semibold tabular-nums leading-tight" style={{ color: accent }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Barras horizontales: [{ key, label, value, color, right }]. El largo es relativo al mayor. */
export function BarList({ rows, format = money }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="report-keep grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-xs">
      {rows.map((r) => (
        <div key={r.key ?? r.label} className="contents">
          <span className="truncate flex items-center gap-1.5">
            {r.color && <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: r.color }} />}
            {r.label}
          </span>
          <span className="rounded-full" style={{ height: 8, background: "var(--surface-alt)" }}>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: r.color || "var(--accent)" }} />
          </span>
          <span className="font-mono tabular-nums text-right">{r.right ?? format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Columnas verticales: [{ key, label, value, top?, highlight?, empty? }]. */
export function ColumnChart({ data, height = 96, format = money, color = "var(--accent)" }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="report-keep flex items-end gap-2" style={{ height: height + 34 }}>
      {data.map((d) => (
        <div key={d.key ?? d.label} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
          <span className="text-[10px] font-mono tabular-nums mb-0.5 whitespace-nowrap" style={{ color: d.empty ? "var(--text-faint)" : "var(--text-muted)" }}>
            {d.empty ? "s/d" : d.top ?? format(d.value)}
          </span>
          <span
            className="w-full rounded-t-md"
            style={{
              height: d.empty ? 2 : Math.max(2, (d.value / max) * height),
              background: d.empty ? "var(--border)" : color,
              opacity: d.highlight || d.empty ? 1 : 0.45,
            }}
          />
          <span className="text-[10px] mt-1 whitespace-nowrap" style={{ color: d.highlight ? "var(--text)" : "var(--text-faint)", fontWeight: d.highlight ? 600 : 400 }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barra apilada (100%): [{ key, label, value, color }]. */
export function StackedBar({ parts, format = money }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="report-keep">
      <div className="flex rounded-full overflow-hidden" style={{ height: 10, background: "var(--surface-alt)" }}>
        {parts.map((p) => (p.value > 0 ? <span key={p.key ?? p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} /> : null))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px]">
        {parts.map((p) => (
          <span key={p.key ?? p.label} className="flex items-center gap-1.5">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: p.color }} />
            {p.label} <b className="font-mono tabular-nums">{format(p.value)}</b>
            <span style={{ color: "var(--text-faint)" }}>({pct(p.value / total)})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Table({ head, children, align = [], className = "" }) {
  return (
    <table className={`w-full text-xs ${className}`} style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ color: "var(--text-faint)" }}>
          {head.map((h, i) => (
            <th key={h} className={`font-medium py-1.5 px-1 ${align[i] === "right" ? "text-right" : "text-left"}`} style={{ borderBottom: "1px solid var(--border)" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Td({ children, right, mono, muted, className = "", ...rest }) {
  return (
    <td
      className={`py-1.5 px-1 align-top ${right ? "text-right" : ""} ${mono ? "font-mono tabular-nums" : ""} ${className}`}
      style={{ borderBottom: "1px solid var(--border)", color: muted ? "var(--text-faint)" : undefined }}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Note({ children }) {
  return (
    <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}

export function Callout({ tone = "info", title, children }) {
  return (
    <div className="report-keep rounded-xl px-3.5 py-3 mt-3" style={{ background: `color-mix(in srgb, ${TONE_COLOR[tone]} 10%, transparent)`, borderLeft: `3px solid ${TONE_COLOR[tone]}` }}>
      {title && <p className="text-sm font-semibold mb-0.5">{title}</p>}
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {children}
      </div>
    </div>
  );
}
