// Gráficos chicos en SVG, sin librerías: mini línea para listas y un gráfico de líneas con puntos,
// líneas punteadas (proyecciones) y una línea de referencia (meta u "hoy").

/** Mini línea (tendencia de una lista). */
export function Sparkline({ values, width = 64, height = 22, color = "var(--accent)" }) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return <span style={{ width, height }} className="inline-block" />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * (width - 2) + 1},${height - 2 - ((y - min) / span) * (height - 4)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Gráfico de líneas. `series`: [{ points: [{ x: number, y: number, mark?: boolean }], color, dashed?, dots?, line? }].
 * x es un número (p. ej. días desde el inicio); `xLabels`: [{ x, label }]; `refLines`: [{ y, label }] o [{ x, label }].
 */
export function LineChart({ series, height = 220, xLabels = [], refLines = [], yFormat = (y) => y, ariaLabel }) {
  const all = series.flatMap((s) => s.points);
  const ys = [...all.map((p) => p.y), ...refLines.filter((r) => r.y != null).map((r) => r.y)];
  const xs = [...all.map((p) => p.x), ...refLines.filter((r) => r.x != null).map((r) => r.x)];
  if (!ys.length) return null;
  const W = 640;
  const H = height;
  const pad = { l: 8, r: 64, t: 14, b: 22 };
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const ySpan = yMax - yMin || 1;
  yMin -= ySpan * 0.12;
  yMax += ySpan * 0.12;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs) === xMin ? xMin + 1 : Math.max(...xs);
  const X = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const Y = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const grid = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      {grid.map((g, i) => (
        <line key={i} x1={pad.l} x2={W - pad.r} y1={Y(g)} y2={Y(g)} stroke="color-mix(in srgb, var(--text) 8%, transparent)" />
      ))}
      {refLines.map((r, i) =>
        r.y != null ? (
          <g key={`r${i}`}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(r.y)} y2={Y(r.y)} stroke="color-mix(in srgb, var(--text) 30%, transparent)" strokeDasharray="3 4" />
            <text x={W - pad.r + 6} y={Y(r.y) + 4} fontSize="11" fill="var(--text-muted)">
              {r.label}
            </text>
          </g>
        ) : (
          <g key={`r${i}`}>
            <line x1={X(r.x)} x2={X(r.x)} y1={pad.t - 6} y2={H - pad.b} stroke="color-mix(in srgb, var(--text) 25%, transparent)" />
            <text x={X(r.x)} y={pad.t - 4} fontSize="10" textAnchor="middle" fill="var(--text-faint)">
              {r.label}
            </text>
          </g>
        )
      )}
      {series.map((s, i) => (
        <g key={i}>
          {s.line !== false && s.points.length > 1 && (
            <polyline points={s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {s.dots &&
            s.points.map((p, j) => <circle key={j} cx={X(p.x)} cy={Y(p.y)} r={p.mark ? 5 : s.dotSize ?? 3} fill={p.mark ? "var(--status-warning)" : s.dotColor ?? s.color} stroke={p.mark ? "var(--surface)" : "none"} strokeWidth="1.5" />)}
          {s.endLabel && s.points.length > 0 && (
            <text x={X(s.points.at(-1).x) + 6} y={Y(s.points.at(-1).y) + 4} fontSize="11" fill="var(--text-muted)">
              {s.endLabel}
            </text>
          )}
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={i} x={X(l.x)} y={H - 4} fontSize="11" textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"} fill="var(--text-faint)">
          {l.label}
        </text>
      ))}
      {/* Valores mín/máx del eje como referencia. */}
      <text x={W - pad.r + 6} y={Y(grid[3]) + 4} fontSize="10" fill="var(--text-faint)">
        {yFormat(grid[3])}
      </text>
      <text x={W - pad.r + 6} y={Y(grid[0]) + 4} fontSize="10" fill="var(--text-faint)">
        {yFormat(grid[0])}
      </text>
    </svg>
  );
}
