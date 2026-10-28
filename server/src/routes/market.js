// Datos de mercado para la sección de tips: inflación INDEC, tasas de plazo fijo, rendimiento de
// FCI money market y de billeteras. Fuente: api.argentinadatos.com (datos públicos de BCRA, INDEC y CAFCI).
import { db } from "../db/index.js";

const BASE = "https://api.argentinadatos.com/v1/finanzas";
const CACHE_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
let cache = null;

async function getJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!resp.ok) throw new Error(`argentinadatos_${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

async function saveSetting(key, value) {
  await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

async function inflation() {
  const rows = await getJson("/indices/inflacion");
  const last = rows.slice(-12);
  // Queda guardada para que toda la app la use sin pedir datos de mercado (ver inflationFromSettings).
  await saveSetting("inflation_auto_pct", rows[rows.length - 1].valor);
  await saveSetting("inflation_auto_month", rows[rows.length - 1].fecha);
  const yearly = last.reduce((acc, r) => acc * (1 + r.valor / 100), 1) - 1;
  return { latest: rows[rows.length - 1], last12: last, yearlyPct: +(yearly * 100).toFixed(1) };
}

async function plazoFijo() {
  const rows = await getJson("/tasas/plazoFijo");
  return rows
    .filter((r) => r.tnaClientes > 0)
    .map((r) => ({ entidad: r.entidad, tna: r.tnaClientes }))
    .sort((a, b) => b.tna - a.tna);
}

/** TNA de los FCI money market en pesos, calculada con el valor de cuotaparte de hoy vs ~30 días atrás. */
async function moneyMarket() {
  const today = await getJson("/fci/mercadoDinero/ultimo");
  const ref = today.find((f) => f.fecha)?.fecha;
  if (!ref) return [];
  let past = null;
  let pastDate = null;
  // El día de referencia puede caer en fin de semana o feriado: probamos hacia atrás.
  for (let back = 30; back <= 36 && !past; back++) {
    pastDate = isoDate(new Date(ref + "T00:00:00Z").getTime() - back * DAY_MS);
    const rows = await getJson(`/fci/mercadoDinero/${pastDate.replaceAll("-", "/")}`).catch(() => []);
    if (rows.length) past = rows;
  }
  if (!past) return [];
  const pastByName = new Map(past.map((f) => [f.fondo, f]));
  const days = (new Date(ref) - new Date(pastDate)) / DAY_MS;
  return today
    .filter((f) => f.fecha === ref && f.patrimonio > 5e10 && !/d[oó]lar|usd|u\$s/i.test(f.fondo))
    .map((f) => {
      const p = pastByName.get(f.fondo);
      if (!p?.vcp) return null;
      const tna = ((f.vcp / p.vcp - 1) * 365) / days;
      return { fondo: f.fondo, tna: +tna.toFixed(4), patrimonio: f.patrimonio };
    })
    .filter((f) => f && f.tna > 0 && f.tna < 1)
    .sort((a, b) => b.tna - a.tna);
}

/** Billeteras / exchanges con rendimiento anual (APY) en pesos o dólares. */
async function billeteras() {
  const rows = await getJson("/rendimientos");
  const out = [];
  for (const e of rows) {
    for (const r of e.rendimientos) {
      if ((r.moneda === "ARS" || r.moneda === "USD") && r.apy > 0) out.push({ entidad: e.entidad, moneda: r.moneda, apy: r.apy, fecha: r.fecha });
    }
  }
  return out.sort((a, b) => b.apy - a.apy);
}

async function load() {
  // Cada fuente es independiente: si una falla, el resto igual se muestra.
  const [inf, pf, mm, bill] = await Promise.allSettled([inflation(), plazoFijo(), moneyMarket(), billeteras()]);
  const val = (r) => (r.status === "fulfilled" ? r.value : null);
  return { inflation: val(inf), plazoFijo: val(pf), moneyMarket: val(mm), billeteras: val(bill), fetchedAt: new Date().toISOString() };
}

/** Precarga en segundo plano (actualiza la inflación guardada). */
export async function prefetchMarket() {
  load()
    .then((data) => {
      if (data.inflation || data.plazoFijo) cache = { data, at: Date.now() };
    })
    .catch(() => {});
}

export default function registerMarketRoutes(app) {
  app.get("/api/market", async (req, res) => {
    if (cache && Date.now() - cache.at < CACHE_MS) return res.json(cache.data);
    try {
      const data = await load();
      if (data.inflation || data.plazoFijo) cache = { data, at: Date.now() };
      res.json(data);
    } catch (err) {
      if (cache) return res.json({ ...cache.data, stale: true });
      res.status(502).json({ error: "unavailable", message: err.message });
    }
  });
}
