import { categoryLabel, categoryColorVar } from "../../lib/expenseCategories.js";
import { merchantTypeLabel } from "../../lib/merchants.js";
import { CATEGORY_GUIDE, SPECIAL_CASES } from "../../lib/classificationGuide.js";
import { paymentMethodLabel, MONTHS_ES } from "../../lib/billing.js";
import { formatShortDate } from "../../lib/format.js";
import { BarList, Callout, ColumnChart, Delta, Kpi, Note, ReportSection, StackedBar, SubHeading, Table, Td, TONE_COLOR, money, num, pct } from "./ReportPrimitives.jsx";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const MERCHANT_COLORS = {
  supermercado: "var(--chart-cat-1)",
  kiosco: "var(--chart-cat-2)",
  almacen: "var(--chart-cat-3)",
  fresco: "var(--chart-cat-6)",
  afuera: "var(--chart-cat-4)",
  delivery: "var(--chart-cat-5)",
  farmacia: "var(--chart-cat-7)",
  online: "var(--chart-cat-8)",
  otro: "var(--text-faint)",
  null: "var(--border)",
};

function Executive({ r }) {
  const { kpis, period, credit } = r;
  const vsPrev = kpis.comparablePrev ? (
    <>
      <Delta value={kpis.paidVsPrev} /> vs {period.prevLabel}
    </>
  ) : (
    "sin período anterior comparable"
  );
  return (
    <ReportSection n={1} title="Resumen ejecutivo">
      <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-2">
        <Kpi label="Pagado en el período (con cuotas)" value={money(kpis.paid)} sub={vsPrev} />
        <Kpi label="Compras nuevas" value={money(kpis.purchasesTotal)} sub={`${kpis.purchasesCount} compras · ticket prom. ${money(kpis.avgTicket)}`} />
        <Kpi label="Gasto por día" value={money(kpis.perDay)} sub={`en ${period.daysElapsed} días${period.closed ? "" : " (período en curso)"}`} />
        {kpis.income > 0 ? (
          <Kpi
            label={kpis.saved >= 0 ? "Ahorro" : "Déficit"}
            value={money(Math.abs(kpis.saved))}
            sub={`${pct(Math.max(0, kpis.savingsRate))} de ${money(kpis.income)} de ingresos`}
            accent={kpis.savingsRate >= 0.2 ? "var(--status-good)" : kpis.savingsRate >= 0 ? "var(--status-warning)" : "var(--status-critical)"}
          />
        ) : (
          <Kpi label="Ingresos" value="—" sub="sin ingresos cargados en el período" />
        )}
        <Kpi label="Comer afuera" value={money(r.eatingOut.total)} sub={`${r.eatingOut.count} veces · ${pct(r.eatingOut.share)} de las compras`} />
        <Kpi label={`Ya comprometido para ${credit.committed[0].label}`} value={money(credit.committed[0].total)} sub="en cuotas firmadas" />
      </div>

      <SubHeading>Lo más importante</SubHeading>
      <ul className="report-keep space-y-1.5">
        {r.highlights.map((h) => (
          <li key={h.text} className="flex gap-2 text-sm leading-snug">
            <span className="inline-block rounded-full shrink-0 mt-1.5" style={{ width: 7, height: 7, background: TONE_COLOR[h.tone] }} />
            <span>{h.text}</span>
          </li>
        ))}
      </ul>
      {!period.closed && <Note>El período todavía no cerró (día {period.daysElapsed} de {period.totalDays}): los números pueden cambiar hasta el cierre.</Note>}
    </ReportSection>
  );
}

function Categories({ r }) {
  const { categories, needsWants: nw, kpis, period } = r;
  const spent = nw.needs + nw.wants;
  return (
    <ReportSection n={2} title="Categorías" subtitle="Pagado en el período, con cuotas de compras anteriores">
      <BarList rows={categories.filter((c) => c.current > 0).map((c) => ({ key: c.category, label: c.label, value: c.current, color: `var(${categoryColorVar(c.category)})`, right: `${money(c.current)} · ${pct(c.share)}` }))} />
      <div className="mt-4 report-keep">
        <Table head={["Categoría", "Monto", "% del total", `vs ${period.prevLabel}`, "vs prom. 3 meses", "Presupuesto"]} align={["left", "right", "right", "right", "right", "right"]}>
          {categories.map((c) => (
            <tr key={c.category}>
              <Td>{c.label}</Td>
              <Td right mono>
                {money(c.current)}
              </Td>
              <Td right mono>
                {pct(c.share)}
              </Td>
              <Td right>{c.prev ? <Delta value={c.vsPrev} /> : <span style={{ color: "var(--text-faint)" }}>—</span>}</Td>
              <Td right>
                {c.average != null ? (
                  <>
                    <Delta value={c.delta} /> <span style={{ color: "var(--text-faint)" }}>({money(c.average)})</span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-faint)" }}>—</span>
                )}
              </Td>
              <Td right mono>
                {c.budget != null ? (
                  <span style={{ color: c.current > c.budget ? "var(--status-critical)" : "var(--status-good)" }}>
                    {pct(c.current / (c.budget || 1))} de {money(c.budget)}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-faint)" }}>sin tope</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </div>
      {!period.historyOk && <Note>Los promedios aparecen cuando haya al menos 2 períodos anteriores completos (la app tiene datos desde {period.firstLabel}).</Note>}

      <SubHeading aside="Regla 50/30/20">Necesidades vs deseos</SubHeading>
      <StackedBar
        parts={[
          { key: "needs", label: "Necesidades", value: nw.needs, color: "var(--chart-cat-1)" },
          { key: "wants", label: "Deseos", value: nw.wants, color: "var(--chart-cat-4)" },
          ...(nw.income > 0 && nw.income > spent ? [{ key: "saved", label: "Ahorro", value: nw.income - spent, color: "var(--status-good)" }] : []),
        ]}
      />
      <Note>
        Necesidades = comida, transporte, servicios, salud y hogar; deseos = ocio, indumentaria y otros.
        {nw.income > 0
          ? ` Con tus ingresos: necesidades ${pct(nw.needs / nw.income)} (referencia ≤ 50%), deseos ${pct(nw.wants / nw.income)} (≤ 30%), ahorro ${pct(Math.max(0, kpis.savingsRate))} (≥ 20%).`
          : " Cargá tus ingresos para compararlo con la referencia 50/30/20."}
      </Note>
    </ReportSection>
  );
}

function Merchants({ r }) {
  const { merchants, kiosk, eatingOut, quality } = r;
  const inferred = merchants.reduce((s, m) => s + m.inferred, 0);
  return (
    <ReportSection n={3} title="Dónde comprás" subtitle="Compras hechas en el período, por su valor total" breakBefore>
      <div className="report-keep">
        <Table head={["Tipo de comercio", "Compras", "Total", "Ticket prom.", "Por semana", "%"]} align={["left", "right", "right", "right", "right", "right"]}>
          {merchants.map((m) => (
            <tr key={m.id ?? "none"}>
              <Td>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: MERCHANT_COLORS[m.id] }} />
                  {m.label}
                  {m.inferred > 0 && <span style={{ color: "var(--text-faint)" }}>*</span>}
                </span>
              </Td>
              <Td right mono>
                {m.count}
              </Td>
              <Td right mono>
                {money(m.total)}
              </Td>
              <Td right mono>
                {money(m.avgTicket)}
              </Td>
              <Td right mono>
                {num(m.perWeek)}
              </Td>
              <Td right mono>
                {pct(m.share)}
              </Td>
            </tr>
          ))}
        </Table>
      </div>
      <Note>
        {inferred > 0 && `* ${inferred} ${inferred === 1 ? "compra no tenía" : "compras no tenían"} el comercio cargado y se ${inferred === 1 ? "clasificó" : "clasificaron"} por el título. `}
        {quality.missingMerchant.length - inferred > 0 && `${quality.missingMerchant.length - inferred} quedaron "Sin indicar": completalas en "Revisar el mes" para un análisis más fino.`}
      </Note>

      <SubHeading aside={`sobreprecio estimado del kiosco: ${kiosk.markupPct}%`}>Kiosco vs súper</SubHeading>
      {kiosk.count > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Kiosco" value={money(kiosk.total)} sub={`${kiosk.count} compras · ${num(kiosk.perWeek)}/semana · ticket ${money(kiosk.avgTicket)}`} accent={MERCHANT_COLORS.kiosco} />
            <Kpi label="Súper" value={money(kiosk.superTotal)} sub={`${kiosk.superCount} compras · ticket ${money(kiosk.superAvgTicket)}`} accent={MERCHANT_COLORS.supermercado} />
          </div>
          <Callout tone="good" title={`Comprando lo mismo en el súper: ~${money(kiosk.savings)} menos por mes`}>
            Son ~{money(kiosk.savings * 12)} al año si el hábito se mantiene.
            {kiosk.targetPerWeek
              ? ` Otra palanca: bajar de ${num(kiosk.perWeek)} a ${kiosk.targetPerWeek} ${kiosk.targetPerWeek === 1 ? "visita" : "visitas"} por semana ahorra ~${money(kiosk.fewerVisitsSavings)} por mes con tu ticket promedio.`
              : ""}
            {kiosk.vsPrev != null && <> Contra el período anterior (en pesos de hoy), el kiosco <Delta value={kiosk.vsPrev} />.</>}
          </Callout>
          {kiosk.items.length > 0 && (
            <p className="text-xs mt-3">
              <b>Lo que más comprás en el kiosco:</b> {kiosk.items.map((i) => `${i.item}${i.count > 1 ? ` ×${i.count}` : ""}`).join(", ")}.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No hay compras de kiosco en este período (o no están marcadas: revisá el comercio de tus gastos chicos).
        </p>
      )}
      <p className="text-[11px] mt-3 mb-1" style={{ color: "var(--text-faint)" }}>
        Kiosco por período, en pesos de hoy
      </p>
      <ColumnChart data={kiosk.trend.map((t, i) => ({ key: t.label, label: t.label, value: t.totalReal, empty: t.noData, highlight: i === kiosk.trend.length - 1, top: t.noData ? undefined : `${money(t.totalReal)} · ${t.count}` }))} color={MERCHANT_COLORS.kiosco} />

      <SubHeading aside="restaurantes, bares, fast food, delivery">Comer afuera</SubHeading>
      {eatingOut.count > 0 ? (
        <>
          <StackedBar
            parts={[
              { key: "food", label: "Como Comida (reemplaza una comida)", value: eatingOut.asFood, color: "var(--chart-cat-1)" },
              { key: "leisure", label: "Como Ocio (salida o antojo)", value: eatingOut.asLeisure, color: "var(--chart-cat-4)" },
              { key: "other", label: "Otras categorías", value: Math.max(0, eatingOut.total - eatingOut.asFood - eatingOut.asLeisure), color: "var(--text-faint)" },
            ]}
          />
          <Note>
            {eatingOut.count} {eatingOut.count === 1 ? "vez" : "veces"} por {money(eatingOut.total)} ({pct(eatingOut.share)} de las compras)
            {eatingOut.delivery > 0 ? `, de los que ${money(eatingOut.delivery)} fueron delivery` : ""}.
          </Note>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No hay compras marcadas como comer afuera o delivery en este período.
        </p>
      )}
      <p className="text-[11px] mt-3 mb-1" style={{ color: "var(--text-faint)" }}>
        Comer afuera por período, en pesos de hoy
      </p>
      <ColumnChart data={eatingOut.trend.map((t, i) => ({ key: t.label, label: t.label, value: t.totalReal, empty: t.noData, highlight: i === eatingOut.trend.length - 1 }))} color={MERCHANT_COLORS.afuera} />
    </ReportSection>
  );
}

function Habits({ r }) {
  const { habits } = r;
  return (
    <ReportSection n={4} title="Hábitos" subtitle="Compras hechas en el período" breakBefore>
      <SubHeading aside={`fin de semana: ${pct(habits.weekendShare)} del gasto`}>Por día de la semana</SubHeading>
      <ColumnChart data={habits.weekday.map((d) => ({ key: d.label, label: d.label, value: d.total, top: d.count ? `${money(d.total)}` : "—", highlight: d.total === Math.max(...habits.weekday.map((x) => x.total)) }))} />

      <SubHeading aside={`compras de un pago de menos de ${money(habits.ants.threshold)}`}>Gastos hormiga</SubHeading>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Cantidad" value={habits.ants.count} />
        <Kpi label="Suman" value={money(habits.ants.total)} sub={`${pct(habits.ants.share)} de las compras`} />
        <Kpi label="Sostenido, al año" value={money(habits.ants.yearly)} />
      </div>
      <Note>No cuentan las compras en súper o verdulería, ni servicios y salud: la idea es medir lo chico y repetido (kiosco, cafés, antojos, apps).</Note>

      <div className="grid sm:grid-cols-2 print:grid-cols-2 gap-x-6">
        <div className="report-keep">
          <SubHeading>Dónde más gastaste</SubHeading>
          <Table head={["Título", "Veces", "Total"]} align={["left", "right", "right"]}>
            {habits.topPlaces.map((p) => (
              <tr key={p.name}>
                <Td>
                  <span className="block truncate max-w-[14rem]">{p.name}</span>
                </Td>
                <Td right mono>
                  {p.count}
                </Td>
                <Td right mono>
                  {money(p.total)}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="report-keep">
          <SubHeading>Productos que más se repiten</SubHeading>
          {habits.topItems.length ? (
            <Table head={["Producto", "Compras", "En tickets de"]} align={["left", "right", "right"]}>
              {habits.topItems.map((i) => (
                <tr key={i.item}>
                  <Td>{cap(i.item)}</Td>
                  <Td right mono>
                    {i.count}
                  </Td>
                  <Td right mono>
                    {money(i.total)}
                  </Td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Anotá en la descripción qué compraste (separado por comas) para ver qué productos repetís.
            </p>
          )}
        </div>
      </div>
      <Note>"En tickets de" es el total de las compras donde aparece el producto (no su precio suelto).</Note>

      <SubHeading>Compras más grandes</SubHeading>
      <div className="report-keep">
        <Table head={["Fecha", "Título", "Categoría", "Monto"]} align={["left", "left", "left", "right"]}>
          {habits.biggest.map((p) => (
            <tr key={p.id}>
              <Td mono muted>
                {formatShortDate(p.date)}
              </Td>
              <Td>
                {p.title}
                {p.installments > 1 && <span style={{ color: "var(--text-faint)" }}> · {p.installments} cuotas</span>}
              </Td>
              <Td>{categoryLabel(p.category)}</Td>
              <Td right mono>
                {money(p.amount)}
              </Td>
            </tr>
          ))}
        </Table>
      </div>
    </ReportSection>
  );
}

function Credit({ r }) {
  const { credit } = r;
  return (
    <ReportSection n={5} title="Tarjeta, cuotas y gastos fijos">
      <SubHeading aside="pagado en el período">Medio de pago</SubHeading>
      <StackedBar
        parts={[
          { key: "credito", label: "Crédito", value: credit.byMethod.credito, color: "var(--chart-cat-7)" },
          { key: "debito", label: "Débito", value: credit.byMethod.debito, color: "var(--chart-cat-3)" },
          { key: "sin", label: "Sin indicar", value: credit.byMethod.sin, color: "var(--border)" },
        ]}
      />
      <div className="grid sm:grid-cols-2 print:grid-cols-2 gap-x-6">
        <div className="report-keep">
          <SubHeading>Compras nuevas en cuotas</SubHeading>
          {credit.newInstallments.length ? (
            <Table head={["Compra", "Cuotas", "Total"]} align={["left", "right", "right"]}>
              {credit.newInstallments.map((p, i) => (
                <tr key={`${p.title}-${i}`}>
                  <Td>{p.title}</Td>
                  <Td right mono>
                    {p.installments} × {money(p.per)}
                  </Td>
                  <Td right mono>
                    {money(p.amount)}
                  </Td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No tomaste cuotas nuevas este período.
            </p>
          )}
        </div>
        <div className="report-keep">
          <SubHeading>Ya comprometido en cuotas</SubHeading>
          <Table head={["Período", "Monto"]} align={["left", "right"]}>
            {credit.committed.map((c) => (
              <tr key={c.label}>
                <Td>{cap(c.label)}</Td>
                <Td right mono>
                  {money(c.total)}
                </Td>
              </tr>
            ))}
          </Table>
          {credit.releases.length > 0 && <Note>Se liberan: {credit.releases.map((rel) => `${money(rel.amount)}/mes en ${MONTHS_ES[rel.billingMonth.month]}`).join(" · ")}.</Note>}
        </div>
      </div>
      {credit.recurringCount > 0 && (
        <Note>
          Gastos fijos y suscripciones activos: {credit.recurringCount} por {money(credit.recurringTotal)} por mes (los de dólares, a dólar tarjeta).
        </Note>
      )}
    </ReportSection>
  );
}

function Plan({ r }) {
  return (
    <ReportSection n={6} title="Plan para el próximo período" breakBefore>
      {r.recommendations.length ? (
        <ol className="space-y-2">
          {r.recommendations.map((rec, i) => (
            <li key={rec.title} className="report-keep flex gap-3 rounded-xl px-3.5 py-3" style={{ background: "var(--surface-alt)" }}>
              <span className="font-mono text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{rec.title}</p>
                  {rec.impact > 0 && (
                    <span className="text-[11px] font-mono font-semibold whitespace-nowrap" style={{ color: "var(--status-good)" }}>
                      ~{money(rec.impact)}/mes
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {rec.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sin alertas este período: seguí así.
        </p>
      )}
      {r.recommendations.some((x) => x.impact > 0) && <Note>Los ahorros son estimaciones independientes: no se suman entre sí si dos apuntan a los mismos gastos (por ejemplo, kiosco y gastos hormiga).</Note>}

      {r.suggestedBudgets.length > 0 && (
        <>
          <SubHeading aside="necesidades: tu nivel habitual · deseos: 10% menos">Presupuestos sugeridos</SubHeading>
          <div className="report-keep">
            <Table head={["Categoría", "Referencia", "Sugerido", "Tope actual"]} align={["left", "right", "right", "right"]}>
              {r.suggestedBudgets.map((b) => (
                <tr key={b.category}>
                  <Td>{b.label}</Td>
                  <Td right mono muted>
                    {money(b.base)}
                  </Td>
                  <Td right mono>
                    <b>{money(b.target)}</b>
                  </Td>
                  <Td right mono muted>
                    {b.current != null ? money(b.current) : "—"}
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
          <Note>Referencia = promedio de los últimos períodos en pesos de hoy (o este período si todavía no hay historial). Los topes se cargan en Reportes.</Note>
        </>
      )}
    </ReportSection>
  );
}

function Quality({ r }) {
  const { quality: q, inflationPct, kiosk } = r;
  const n = q.count || 1;
  const rows = [
    ["Con categoría (sin contar “Otros”)", q.categorized],
    ["Con comercio cargado", q.withMerchant],
    ["Con descripción", q.withDescription],
  ];
  return (
    <ReportSection n={7} title="Calidad de los datos y metodología">
      <div className="report-keep flex items-center gap-4">
        <div className="text-center">
          <p className="font-mono text-3xl font-semibold" style={{ color: q.score >= 80 ? "var(--status-good)" : q.score >= 50 ? "var(--status-warning)" : "var(--status-critical)" }}>
            {q.score}%
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            datos completos
          </p>
        </div>
        <div className="flex-1">
          <BarList rows={rows.map(([label, v]) => ({ label, value: v / n, right: `${v} de ${q.count}`, color: "var(--accent)" }))} format={(v) => pct(v)} />
        </div>
      </div>
      {q.duplicates.length > 0 && (
        <Callout tone="warn" title={`${q.duplicates.length} posibles duplicados`}>
          {q.duplicates.map(([a, b]) => `“${a.title}” y “${b.title}” (${money(a.amount)}, ${formatShortDate(a.date)})`).join(" · ")}. Si son la misma compra cargada dos veces (por ejemplo, a mano y desde el resumen), borrá una.
        </Callout>
      )}
      {q.suspicious.length > 0 && (
        <Callout tone="info" title="Categorías para revisar">
          {q.suspicious.map((s) => `“${s.expense.title}” está en ${categoryLabel(s.expense.category)} y parece ${categoryLabel(s.guess)}`).join(" · ")}.
        </Callout>
      )}

      <SubHeading>Cómo se calcula</SubHeading>
      <ul className="report-keep text-xs space-y-1 list-disc pl-4" style={{ color: "var(--text-muted)" }}>
        <li>Período = ciclo de la tarjeta ({r.period.range}). Una compra después del cierre cuenta para el período siguiente.</li>
        <li>“Pagado en el período” suma lo que entra en el resumen: compras de un pago y la cuota del mes de compras anteriores. “Compras del período” toma cada compra hecha en el período una sola vez, por su valor total (sirve para ver hábitos).</li>
        <li>Las comparaciones entre períodos se pasan a pesos de hoy con una inflación de {num(inflationPct)}% mensual. Solo se compara contra períodos con al menos 10 compras y no menos del 40% de las de este, para que los primeros meses de uso no distorsionen.</li>
        <li>El tipo de comercio es el que cargaste; si falta, se deduce del título (y de lo que ya clasificaste antes con el mismo título).</li>
        <li>Ahorro del kiosco = gasto en kiosco × (1 − 1/(1 + {kiosk.markupPct}%)). Como referencia, Scentia midió que almacenes y autoservicios cobraban ~27% más que súper e hipermercados (2024; promedio histórico ~10%), y los kioscos suelen estar por encima. Ajustá el porcentaje con tus propios precios.</li>
        <li>Gastos hormiga = compras de un pago de menos del 2% de lo pagado en el período, fuera de súper, verdulería, servicios y salud.</li>
      </ul>

      <SubHeading>Criterios de clasificación</SubHeading>
      <div className="report-keep grid sm:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {CATEGORY_GUIDE.map((c) => (
          <p key={c.id}>
            <b>{categoryLabel(c.id)}:</b> <span style={{ color: "var(--text-muted)" }}>{c.rule} {c.includes}</span>
          </p>
        ))}
      </div>
      <p className="text-xs mt-2">
        <b>{SPECIAL_CASES[0].title}</b> <span style={{ color: "var(--text-muted)" }}>{SPECIAL_CASES[0].body}</span>
      </p>
    </ReportSection>
  );
}

function Annex({ r }) {
  return (
    <ReportSection n={8} title="Anexo: compras del período" subtitle={`${r.purchases.length} compras · * comercio deducido`} breakBefore>
      <Table head={["Fecha", "Título", "Descripción", "Categoría", "Comercio", "Medio", "Monto"]} align={["left", "left", "left", "left", "left", "left", "right"]} className="text-[11px]">
        {r.purchases.map((p) => (
          <tr key={p.id} style={{ breakInside: "avoid" }}>
            <Td mono muted className="whitespace-nowrap">
              {formatShortDate(p.date)}
            </Td>
            <Td>{p.title}</Td>
            <Td muted>{p.description || ""}</Td>
            <Td>{p.category ? categoryLabel(p.category) : "—"}</Td>
            <Td>
              {p.merchant ? merchantTypeLabel(p.merchant) : "—"}
              {p.merchantInferred ? "*" : ""}
            </Td>
            <Td muted>{paymentMethodLabel(p.paymentMethod) ?? "—"}</Td>
            <Td right mono className="whitespace-nowrap">
              {money(p.amount)}
              {p.installments > 1 && <span style={{ color: "var(--text-faint)" }}> ({p.installments}c)</span>}
            </Td>
          </tr>
        ))}
      </Table>
    </ReportSection>
  );
}

export function ReportDocument({ report: r, generatedAt }) {
  return (
    <article className="report-paper rounded-2xl p-5 sm:p-8 mx-auto max-w-[52rem]" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <header className="flex items-start justify-between gap-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            Análisis mensual de gastos
          </p>
          <h1 className="text-2xl font-semibold capitalize mt-0.5">{r.period.label}</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Período de tarjeta {r.period.range}
            {r.period.closed ? "" : ` · en curso (día ${r.period.daysElapsed} de ${r.period.totalDays})`}
          </p>
        </div>
        <p className="text-[11px] text-right shrink-0" style={{ color: "var(--text-faint)" }}>
          Generado el {generatedAt}
          <br />
          Gestor · Gastos
        </p>
      </header>
      <Executive r={r} />
      <Categories r={r} />
      <Merchants r={r} />
      <Habits r={r} />
      <Credit r={r} />
      <Plan r={r} />
      <Quality r={r} />
      <Annex r={r} />
    </article>
  );
}
