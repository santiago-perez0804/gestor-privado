import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Calculator, ChevronDown, DollarSign, ExternalLink, Landmark, Lightbulb, Percent, Tags, TrendingUp } from "lucide-react";
import { Card } from "../../components/common/Card.jsx";
import { SectionHeading } from "../../components/common/SectionHeading.jsx";
import { PageHeader } from "../../components/common/PageHeader.jsx";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { FieldLabel, inputClass } from "../../components/common/FieldLabel.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { currency } from "../../lib/format.js";
import { MONTHS_ES } from "../../lib/billing.js";
import { inflationFromSettings } from "../../lib/finance.js";
import { getIconComponent } from "../../lib/icons.js";
import { categoryColorVar, categoryLabel } from "../../lib/expenseCategories.js";
import { CATEGORY_GUIDE, FIELD_TIPS, SPECIAL_CASES } from "../../lib/classificationGuide.js";

const pct = (x, d = 1) => `${(x * 100).toFixed(d).replace(".", ",")}%`;
const money = (x) => currency.format(Math.round(x));
/** Rendimiento mensual de una TNA (convención de plazo fijo: TNA × 30/365). */
const monthlyFromTna = (tna) => (tna * 30) / 365;
const realRate = (nominal, inflation) => (1 + nominal) / (1 + inflation) - 1;
const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/ S\.?a\.?u?\.?$/i, "");

function Tone({ ok, children }) {
  return (
    <span className="font-mono font-semibold" style={{ color: ok ? "var(--status-good)" : "var(--status-warning)" }}>
      {children}
    </span>
  );
}

/** ¿Le gana a la inflación? Plazo fijo, money market y billeteras contra el último IPC. */
function MarketCard({ market, inflationPct }) {
  const inf = inflationPct / 100;
  const latest = market?.inflation?.latest;
  const pfTop = market?.plazoFijo?.slice(0, 3) ?? [];
  const pfBig = (market?.plazoFijo ?? []).filter((b) => /NACION|GALICIA|SANTANDER|BBVA|PROVINCIA DE BUENOS|MACRO/i.test(b.entidad));
  const mm = market?.moneyMarket?.slice(0, 3) ?? [];
  const wallets = (market?.billeteras ?? []).filter((b) => b.moneda === "ARS").slice(0, 3);

  const Row = ({ name, tna, note }) => {
    const m = monthlyFromTna(tna);
    const real = realRate(m, inf);
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="flex-1 min-w-0 truncate" title={name}>
          {name}
          {note && (
            <span className="text-[10px] ml-1" style={{ color: "var(--text-faint)" }}>
              {note}
            </span>
          )}
        </span>
        <span className="font-mono text-xs w-14 text-right" title="Tasa nominal anual">
          {pct(tna)}
        </span>
        <span className="font-mono text-xs w-14 text-right" title="Por mes">
          {pct(m, 2)}
        </span>
        <span className="w-16 text-right text-xs" title="Rendimiento real mensual (descontada la inflación)">
          <Tone ok={real >= 0}>
            {real >= 0 ? "+" : ""}
            {pct(real, 2)}
          </Tone>
        </span>
      </div>
    );
  };

  return (
    <Card>
      <SectionHeading icon={TrendingUp}>¿Tu plata le gana a la inflación?</SectionHeading>
      {!market ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Cargando tasas del día…
        </p>
      ) : (
        <>
          <p className="text-sm mb-3">
            Inflación {latest ? `de ${MONTHS_ES[parseInt(latest.fecha.slice(5, 7), 10) - 1]}` : "mensual"}: <b className="font-mono">{inflationPct}%</b>
            {market.inflation?.yearlyPct != null && (
              <span style={{ color: "var(--text-muted)" }}> · últimos 12 meses: {String(market.inflation.yearlyPct).replace(".", ",")}%</span>
            )}
          </p>
          <div className="flex text-[10px] uppercase tracking-wide pb-1" style={{ color: "var(--text-faint)" }}>
            <span className="flex-1">Dónde</span>
            <span className="w-14 text-right">TNA</span>
            <span className="w-14 text-right">Mes</span>
            <span className="w-16 text-right">Real/mes</span>
          </div>
          {pfTop.length > 0 && (
            <p className="text-[11px] font-semibold mt-2" style={{ color: "var(--text-muted)" }}>
              Plazo fijo 30 días · mejores tasas
            </p>
          )}
          {pfTop.map((b) => (
            <Row key={b.entidad} name={titleCase(b.entidad)} tna={b.tna} />
          ))}
          {pfBig.length > 0 && (
            <p className="text-[11px] font-semibold mt-2" style={{ color: "var(--text-muted)" }}>
              Plazo fijo · bancos grandes
            </p>
          )}
          {pfBig.slice(0, 4).map((b) => (
            <Row key={b.entidad} name={titleCase(b.entidad)} tna={b.tna} />
          ))}
          {mm.length > 0 && (
            <p className="text-[11px] font-semibold mt-2" style={{ color: "var(--text-muted)" }}>
              FCI money market (rescate inmediato) · últimos 30 días
            </p>
          )}
          {mm.map((f) => (
            <Row key={f.fondo} name={f.fondo} tna={f.tna} />
          ))}
          {wallets.length > 0 && (
            <p className="text-[11px] font-semibold mt-2" style={{ color: "var(--text-muted)" }}>
              Billeteras / cuentas remuneradas
            </p>
          )}
          {wallets.map((w) => (
            <Row key={w.entidad} name={titleCase(w.entidad)} tna={w.apy / 100} note={w.apy >= 20 ? "puede tener tope" : null} />
          ))}
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-faint)" }}>
            "Real/mes" = cuánto crece tu poder de compra por mes después de la inflación. Si da negativo, la plata igual se achica, pero mucho menos que quieta en la caja de ahorro (que rinde 0%: pierde {inflationPct}% por mes). Los datos son públicos (BCRA, CAFCI, INDEC) vía ArgentinaDatos y pueden tener uno o dos días de atraso: confirmá la tasa en tu banco antes de invertir.
          </p>
        </>
      )}
    </Card>
  );
}

function NumberField({ label, value, onChange, suffix }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass()} />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-faint)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Cuotas vs contado: trae cada cuota a valor de hoy descontándola con la inflación (o con lo que rendiría la plata). */
function InstallmentsCalculator({ inflationPct, bestTna }) {
  const [cash, setCash] = useState("100000");
  const [total, setTotal] = useState("110000");
  const [n, setN] = useState("6");
  const [mode, setMode] = useState("inflation");
  const cashN = parseFloat(cash) || 0;
  const totalN = parseFloat(total) || 0;
  const nN = Math.max(1, parseInt(n, 10) || 1);
  const rate = mode === "inflation" ? inflationPct / 100 : monthlyFromTna(bestTna || 0);
  const cuota = totalN / nN;
  // La primera cuota se paga en el primer resumen (~1 mes después de la compra).
  let pv = 0;
  for (let k = 1; k <= nN; k++) pv += cuota / Math.pow(1 + rate, k);
  const surcharge = cashN > 0 ? totalN / cashN - 1 : 0;
  const better = pv < cashN ? "cuotas" : "contado";
  const diff = Math.abs(cashN - pv);

  return (
    <Card>
      <SectionHeading icon={Calculator}>¿Cuotas o contado?</SectionHeading>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Precio contado" value={cash} onChange={setCash} />
        <NumberField label="Total en cuotas" value={total} onChange={setTotal} />
        <NumberField label="Cuotas" value={n} onChange={setN} />
      </div>
      <div className="flex gap-1.5 mt-2">
        {[
          { id: "inflation", label: `Contra inflación (${inflationPct}%)` },
          { id: "invest", label: `Si invertís la plata (${bestTna ? pct(monthlyFromTna(bestTna), 2) : "—"}/mes)` },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setMode(o.id)}
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: mode === o.id ? "var(--accent-soft)" : "var(--surface-alt)", color: mode === o.id ? "var(--accent-strong)" : "var(--text-muted)" }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {cashN > 0 && totalN > 0 && (
        <div className="rounded-xl p-3 mt-3" style={{ background: "var(--surface-alt)" }}>
          <p className="text-sm">
            {nN} cuotas de {money(cuota)} (recargo {pct(surcharge)}) equivalen hoy a <b className="font-mono">{money(pv)}</b>.
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: better === "cuotas" ? "var(--status-good)" : "var(--status-warning)" }}>
            {better === "cuotas" ? `Conviene en cuotas: ahorrás ~${money(diff)} en pesos de hoy.` : `Conviene de contado: las cuotas te cuestan ~${money(diff)} de más.`}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>
            Supone inflación/tasa constante. Si te ofrecen descuento por pagar contado, poné el precio con descuento arriba.
          </p>
        </div>
      )}
    </Card>
  );
}

/** Interés compuesto con aportes mensuales, nominal y en pesos de hoy. */
function GrowthCalculator({ inflationPct, bestTna }) {
  const [initial, setInitial] = useState("500000");
  const [monthly, setMonthly] = useState("100000");
  const [tna, setTna] = useState(bestTna ? String(+(bestTna * 100).toFixed(1)) : "20");
  const [months, setMonths] = useState("12");
  const r = monthlyFromTna((parseFloat(tna) || 0) / 100);
  const m = Math.max(1, Math.min(600, parseInt(months, 10) || 1));
  const inf = inflationPct / 100;
  let balance = parseFloat(initial) || 0;
  const add = parseFloat(monthly) || 0;
  for (let i = 0; i < m; i++) balance = balance * (1 + r) + add;
  const contributed = (parseFloat(initial) || 0) + add * m;
  const real = balance / Math.pow(1 + inf, m);

  return (
    <Card>
      <SectionHeading icon={Percent}>¿Cuánto junto si ahorro todos los meses?</SectionHeading>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Tengo hoy" value={initial} onChange={setInitial} />
        <NumberField label="Aporto por mes" value={monthly} onChange={setMonthly} />
        <NumberField label="Tasa (TNA)" value={tna} onChange={setTna} suffix="%" />
        <NumberField label="Meses" value={months} onChange={setMonths} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {[
          ["Aportaste", contributed],
          ["Tendrías", balance],
          ["En pesos de hoy", real],
        ].map(([label, v]) => (
          <div key={label} className="rounded-xl py-2" style={{ background: "var(--surface-alt)" }}>
            <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
              {label}
            </p>
            <p className="font-mono text-sm font-semibold">{money(v)}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
        "En pesos de hoy" descuenta una inflación de {inflationPct}% mensual sostenida. La tasa sugerida es la mejor de plazo fijo del día; las tasas en pesos cambian seguido.
      </p>
    </Card>
  );
}

/** Dólar tarjeta vs pagar el resumen en dólares comprados por MEP. */
function DollarCard({ rates }) {
  const card = rates?.tarjeta?.venta;
  const mep = rates?.bolsa?.venta;
  const saving = card && mep ? 1 - mep / card : null;
  return (
    <Card>
      <SectionHeading icon={DollarSign}>Compras en dólares con tarjeta</SectionHeading>
      {card && mep && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          <div className="rounded-xl py-2" style={{ background: "var(--surface-alt)" }}>
            <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
              Pagando en pesos (tarjeta)
            </p>
            <p className="font-mono font-semibold">{money(card)}</p>
          </div>
          <div className="rounded-xl py-2" style={{ background: "var(--surface-alt)" }}>
            <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
              Pagando con dólares MEP
            </p>
            <p className="font-mono font-semibold" style={{ color: "var(--status-good)" }}>
              {money(mep)}
            </p>
          </div>
        </div>
      )}
      <p className="text-sm leading-relaxed">
        Si pagás el resumen en pesos, el banco convierte tus consumos en dólares (Netflix, Spotify, Steam, compras afuera) al oficial <b>+ 30% de percepción</b> de Ganancias.
        {saving != null && <> Pagándolos en dólares te ahorrás hoy un <b>{pct(saving, 0)}</b>.</>}
      </p>
      <ol className="text-sm list-decimal pl-5 mt-2 space-y-1" style={{ color: "var(--text-muted)" }}>
        <li>Antes del vencimiento, pedí "stop debit" del débito automático (desde el home banking o la app).</li>
        <li>Comprá los dólares del saldo en USD (MEP o en tu banco) y pagá esa parte del resumen en dólares.</li>
        <li>El resto lo pagás en pesos como siempre. Más simple: vinculá los consumos en dólares a tu caja de ahorro en USD, si tu banco lo permite.</li>
        <li>
          Si ya pagaste en pesos, la percepción se recupera: en relación de dependencia, por SiRADIG; si no estás inscripto en Ganancias, pidiendo la devolución a ARCA desde el 1° de enero del año siguiente.
        </li>
      </ol>
    </Card>
  );
}

const GUIDE = [
  {
    icon: "PiggyBank",
    title: "Págate primero",
    body: "El día que cobrás, pasá un monto fijo (idealmente el 20%) a otra cuenta o a un money market antes de gastar nada. Lo que queda es lo que tenés para el mes. Si esperás a ver \"qué sobra\", casi nunca sobra. Con un ingreso fijo cargado en la app, sabés exactamente qué día hacerlo.",
  },
  {
    icon: "ShieldCheck",
    title: "Fondo de emergencia: 3 a 6 meses de gastos esenciales",
    body: "Es la plata para que un imprevisto (te quedás sin trabajo, se rompe algo, un tema de salud) no termine en deuda de tarjeta. Tiene que estar líquida y protegida de la inflación: cuenta remunerada o FCI money market, no en la caja de ahorro ni en un plazo fijo largo. Creá una meta \"Fondo de emergencia\" y la app te dice cuántos meses cubre.",
  },
  {
    icon: "CreditCard",
    title: "Pagá siempre el total de la tarjeta, nunca el mínimo",
    body: "Lo que no pagás se financia con intereses que están muy por encima de la inflación, más IVA sobre los intereses y, si te atrasás, punitorios. Es una de las deudas más caras que existen. Si un mes no llegás, es mejor refinanciar en cuotas fijas (y mirar el CFT) que arrastrar el saldo.",
  },
  {
    icon: "Hourglass",
    title: "Regla de las 72 horas para compras no planeadas",
    body: "Si algo no estaba en tu plan y cuesta más que una salida, esperá 3 días antes de comprarlo. La mayoría de las ganas se pasan. Si a los 3 días lo seguís queriendo, compralo tranquilo: ya no es impulso.",
  },
  {
    icon: "Bug",
    title: "Gastos hormiga",
    body: "Café, delivery, kiosco, apps: de a uno no se sienten, pero sumados suelen ser el 5–10% del gasto. La app te avisa cuando hay muchos. No hace falta eliminarlos: poné un tope semanal en efectivo o en una billetera aparte.",
  },
  {
    icon: "Repeat",
    title: "Auditoría de suscripciones cada 3 meses",
    body: "Repasá Gastos recurrentes: todo lo que no usaste en el último mes, afuera. Las suscripciones en dólares pesan más de lo que parece por el dólar tarjeta. Muchas plataformas tienen plan anual o familiar más barato.",
  },
  {
    icon: "Percent",
    title: "Cuotas sin interés: casi siempre convienen",
    body: "Con inflación positiva, cada cuota futura vale menos en pesos de hoy. Si el precio en cuotas es el mismo que de contado, convienen siempre. Si tienen recargo o el contado tiene descuento, usá la calculadora de arriba. Ojo con acumular cuotas: la app te avisa qué parte de tu próximo ingreso ya está comprometida.",
  },
  {
    icon: "BadgePercent",
    title: "Descuentos y reintegros de bancos y billeteras",
    body: "Bancos y billeteras tienen días de descuento en súper, combustible, farmacias y gastronomía. Revisá los de tu banco una vez por mes y concentrá las compras grandes esos días. Fijate el tope de reintegro: pasado ese monto, el descuento no aplica.",
  },
  {
    icon: "Wallet",
    title: "Nunca dejes pesos quietos",
    body: "La caja de ahorro común no paga nada: con la inflación actual, en un año perdés cerca de un cuarto del poder de compra. Para plata que vas a usar pronto, cuenta remunerada o money market (se rescata en el momento). Para plata que no tocás por un mes o más, compará con el plazo fijo.",
  },
  {
    icon: "Scale",
    title: "Deudas: primero la más cara",
    body: "Si tenés varias deudas, pagá el mínimo en todas y todo lo extra a la de tasa más alta (método avalancha). Si te motiva más ver deudas cerradas, empezá por la más chica (bola de nieve). Lo importante es no sumar deuda nueva mientras tanto.",
  },
  {
    icon: "Gift",
    title: "Aguinaldo, bonos y aumentos: decidí antes de cobrar",
    body: "Definí de antemano qué parte va a ahorro o metas (por ejemplo, la mitad) y qué parte a darte un gusto. Cuando una compra en cuotas termina, mandá ese monto a una meta en vez de absorberlo: la app te avisa cuándo se liberan cuotas.",
  },
  {
    icon: "Coins",
    title: "Diversificá entre pesos y dólares",
    body: "Los dólares protegen de una devaluación pero no rinden en pesos; los pesos rinden pero pueden perder contra el dólar. Tener parte en cada uno según tus planes (si vas a viajar o comprar algo en dólares, ahorrá en dólares) reduce el riesgo. En la sección Cuentas ves cómo está repartido tu patrimonio.",
  },
];

function Guide() {
  const [open, setOpen] = useState(0);
  return (
    <Card>
      <SectionHeading icon={Lightbulb}>Guía rápida</SectionHeading>
      {GUIDE.map((g, i) => {
        const Icon = getIconComponent(g.icon, "Lightbulb");
        const isOpen = open === i;
        return (
          <div key={g.title} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
            <button onClick={() => setOpen(isOpen ? -1 : i)} className="w-full flex items-center gap-2.5 py-2.5 text-left" aria-expanded={isOpen}>
              <Icon size={16} style={{ color: "var(--accent-strong)" }} className="shrink-0" />
              <span className="flex-1 text-sm font-medium">{g.title}</span>
              <ChevronDown size={15} style={{ color: "var(--text-faint)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {isOpen && (
              <p className="text-sm pb-3 pl-7 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {g.body}
              </p>
            )}
          </div>
        );
      })}
    </Card>
  );
}

/** Cómo cargar y clasificar: qué va en título y descripción, qué entra en cada categoría y los casos dudosos. */
function ClassificationGuide() {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  const { hash } = useLocation();

  // Los ⓘ del formulario traen acá con #clasificar.
  useEffect(() => {
    if (hash === "#clasificar") ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div ref={ref} id="clasificar" className="lg:col-span-2 scroll-mt-4">
      <Card>
        <SectionHeading icon={Tags}>Cómo cargar y clasificar tus gastos</SectionHeading>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            {[FIELD_TIPS.title, FIELD_TIPS.description].map((tip) => (
              <div key={tip.title} className="mb-3">
                <p className="text-sm font-semibold mb-1">{tip.title}</p>
                <ul className="text-sm space-y-1 list-disc pl-5" style={{ color: "var(--text-muted)" }}>
                  {tip.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-sm font-semibold mb-1">Casos dudosos</p>
            {SPECIAL_CASES.map((c, i) => {
              const isOpen = open === c.id;
              return (
                <div key={c.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <button onClick={() => setOpen(isOpen ? null : c.id)} className="w-full flex items-center gap-2 py-2 text-left" aria-expanded={isOpen}>
                    <span className="flex-1 text-sm font-medium">{c.title}</span>
                    <ChevronDown size={15} style={{ color: "var(--text-faint)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </button>
                  {isOpen && (
                    <p className="text-sm pb-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {c.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">Qué va en cada categoría</p>
            <div className="flex flex-col">
              {CATEGORY_GUIDE.map((c, i) => (
                <div key={c.id} className="py-2" style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: `var(${categoryColorVar(c.id)})` }} />
                    {categoryLabel(c.id)}
                    <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                      · {c.rule}
                    </span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {c.includes}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    No: {c.excludes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--text-faint)" }}>
          {FIELD_TIPS.merchant.lines[0]} Con título, descripción y comercio bien cargados, el informe mensual compara kiosco vs súper, cuánto comés afuera y qué productos repetís.
        </p>
      </Card>
    </div>
  );
}

const SOURCES = [
  ["ArgentinaDatos (tasas, FCI, inflación)", "https://argentinadatos.com"],
  ["DolarApi (cotizaciones)", "https://dolarapi.com"],
  ["El Cronista: por qué sigue el dólar tarjeta (sep 2026)", "https://www.cronista.com/economia-politica/por-que-no-se-elimino-el-dolar-tarjeta-cuanto-recaudo-arca-en-lo-que-va-de-2026/"],
  ["El Destape: pagar la tarjeta en dólares (oct 2026)", "https://www.eldestapeweb.com/economia/pagar-dolares-tarjeta-octubre-2026-ahorrar-evitar-recargos-202610611469"],
];

export function Tips() {
  const data = useApi(() => Promise.all([api.getMarket().catch(() => null), api.getExchangeRates().catch(() => null), api.getSettings()]), []);
  const [market, rates, settings] = data.data || [];
  const inflationPct = market?.inflation?.latest?.valor ?? inflationFromSettings(settings);
  const bestTna = market?.plazoFijo?.[0]?.tna ?? null;

  return (
    <PageTransition>
      <PageHeader title="Tips para tu plata" subtitle="Con datos del día y calculadoras" />
      <div className="grid gap-4 items-start lg:grid-cols-2 [&>*]:min-w-0">
        <ClassificationGuide />
        <MarketCard market={data.data ? market : null} inflationPct={inflationPct} />
        <DollarCard rates={rates} />
        <InstallmentsCalculator inflationPct={inflationPct} bestTna={bestTna} />
        <GrowthCalculator key={bestTna} inflationPct={inflationPct} bestTna={bestTna} />
        <Guide />
        <Card>
          <SectionHeading icon={Landmark}>Fuentes</SectionHeading>
          <ul className="space-y-1">
            {SOURCES.map(([label, url]) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1" style={{ color: "var(--accent-strong)" }}>
                  {label}
                  <ExternalLink size={11} />
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            Información general, no es asesoramiento financiero. Las tasas y normas cambian: confirmá con tu banco o con ARCA antes de decidir.
          </p>
        </Card>
      </div>
    </PageTransition>
  );
}
