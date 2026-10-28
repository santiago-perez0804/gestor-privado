// Pedidos a catálogos externos: caché local, un pedido por vez por fuente (con un mínimo entre
// pedidos, para no pegarle a los límites) y reintentos con espera creciente ante 429 y 5xx.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Error de una fuente externa, con el status HTTP (0 = sin red / timeout). */
export class CatalogError extends Error {
  constructor(source, status, message) {
    super(message || `${source}: ${status ? `HTTP ${status}` : "sin conexión"}`);
    this.source = source;
    this.status = status;
  }
}

/**
 * Cola por fuente: espera a que termine el pedido anterior y deja `minIntervalMs` entre pedidos.
 * @returns {(task: () => Promise<any>) => Promise<any>}
 */
export function createLimiter(minIntervalMs) {
  let chain = Promise.resolve();
  let last = 0;
  return (task) => {
    const run = chain.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      return task();
    });
    chain = run.catch(() => {});
    return run;
  };
}

/** Cuánto esperar antes del reintento `attempt` (0, 1, 2…): 500 ms, 1 s, 2 s… con algo de azar. */
export function backoffDelay(attempt, retryAfterHeader) {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  return 500 * 2 ** attempt + Math.floor(Math.random() * 200);
}

/**
 * GET que devuelve JSON, con reintentos ante 429 / 5xx / errores de red.
 * @param {{ source: string, limiter?: Function, headers?: object, retries?: number, timeoutMs?: number, fetchImpl?: typeof fetch, backoff?: Function }} opts
 */
export async function fetchJson(url, { source, limiter, headers = {}, retries = 3, timeoutMs = 8000, fetchImpl = fetch, backoff = backoffDelay } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const doFetch = () => fetchImpl(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    let res;
    try {
      res = await (limiter ? limiter(doFetch) : doFetch());
    } catch {
      lastError = new CatalogError(source, 0);
      if (attempt < retries) await sleep(backoff(attempt));
      continue;
    }
    if (res.ok) return res.json();
    lastError = new CatalogError(source, res.status);
    // 4xx (salvo 429) no se arregla reintentando: key inválida, pedido mal armado, etc.
    if (res.status !== 429 && res.status < 500) throw lastError;
    if (attempt < retries) await sleep(backoff(attempt, res.headers.get("retry-after")));
  }
  throw lastError;
}

/**
 * Caché en la base (tabla catalog_cache): guarda la respuesta normalizada por una clave.
 * @param {import("node:sqlite").DatabaseSync} db
 */
export function createCache(db) {
  const getStmt = db.prepare("SELECT value, fetchedAt FROM catalog_cache WHERE key = ?");
  const setStmt = db.prepare("INSERT INTO catalog_cache (key, value, fetchedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetchedAt = excluded.fetchedAt");
  return {
    /** Devuelve lo guardado si no venció; si `allowStale`, también lo vencido (para cuando no hay red). */
    async get(key, ttlMs, { allowStale = false } = {}) {
      const row = await getStmt.get(key);
      if (!row) return null;
      const fresh = Date.now() - new Date(row.fetchedAt).getTime() < ttlMs;
      return fresh || allowStale ? JSON.parse(row.value) : null;
    },
    async set(key, value) {
      await setStmt.run(key, JSON.stringify(value), new Date().toISOString());
    },
  };
}

/**
 * Busca en caché; si no está (o venció), lo pide. Si el pedido falla y hay algo viejo guardado,
 * devuelve eso: la app sigue andando sin red.
 */
export async function cached(cache, key, ttlMs, load) {
  const hit = await cache.get(key, ttlMs);
  if (hit) return hit;
  try {
    const value = await load();
    await cache.set(key, value);
    return value;
  } catch (err) {
    const stale = await cache.get(key, ttlMs, { allowStale: true });
    if (stale) return stale;
    throw err;
  }
}
