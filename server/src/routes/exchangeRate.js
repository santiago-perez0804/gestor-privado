import { db } from "../db/index.js";

const CACHE_MS = 5 * 60 * 1000;
const LAST_RATES_KEY = "last_exchange_rates";
// Casas de dolarapi que ofrecemos. "tarjeta" = oficial + 30% de percepción (lo que cobra el banco si pagás en pesos).
export const RATE_TYPES = ["tarjeta", "blue", "bolsa", "oficial", "cripto"];
let cache = null;

function saveLastRates(rates) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(LAST_RATES_KEY, JSON.stringify(rates));
}

/** Últimas cotizaciones guardadas (sirven sin internet, p. ej. para generar recurrentes en USD). */
export function lastKnownRates() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(LAST_RATES_KEY);
  try {
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

export function lastKnownRate(type = "tarjeta", side = "venta") {
  return lastKnownRates()?.[type]?.[side] ?? null;
}

/** Todas las cotizaciones: { tarjeta: {compra, venta}, blue: {...}, ..., fetchedAt }. */
export async function fetchRates() {
  if (cache && Date.now() - cache.fetchedAtMs < CACHE_MS) return cache.rates;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch("https://dolarapi.com/v1/dolares", { signal: controller.signal });
    if (!resp.ok) throw new Error(`dolarapi_status_${resp.status}`);
    const list = await resp.json();
    const rates = { fetchedAt: new Date().toISOString() };
    for (const r of list) if (RATE_TYPES.includes(r.casa)) rates[r.casa] = { compra: r.compra, venta: r.venta };
    cache = { rates, fetchedAtMs: Date.now() };
    saveLastRates(rates);
    return rates;
  } finally {
    clearTimeout(timeout);
  }
}

export default function registerExchangeRateRoutes(app) {
  // ?type=tarjeta|blue|bolsa|oficial|cripto (default blue) · ?side=venta|compra (default venta)
  app.get("/api/exchange-rate", async (req, res) => {
    const type = RATE_TYPES.includes(req.query.type) ? req.query.type : "blue";
    const side = req.query.side === "compra" ? "compra" : "venta";
    try {
      const rates = await fetchRates();
      res.json({ rate: rates[type][side], type, side, fetchedAt: rates.fetchedAt, source: "dolarapi" });
    } catch (err) {
      const fallback = lastKnownRate(type, side);
      if (fallback) return res.json({ rate: fallback, type, side, fetchedAt: lastKnownRates().fetchedAt, source: "guardada", stale: true });
      res.status(502).json({ error: "unavailable", message: err.message });
    }
  });

  app.get("/api/exchange-rates", async (req, res) => {
    try {
      res.json(await fetchRates());
    } catch (err) {
      const fallback = lastKnownRates();
      if (fallback) return res.json({ ...fallback, stale: true });
      res.status(502).json({ error: "unavailable", message: err.message });
    }
  });
}
