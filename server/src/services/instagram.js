// Cliente mínimo de la "Instagram API with Instagram Login" (graph.instagram.com).
// Las llamadas van sin versión explícita: Meta usa la versión más vieja disponible para la app,
// así no se rompe cuando una versión fija queda deprecada.
const BASE_URL = "https://graph.instagram.com";
const TIMEOUT_MS = 8000;
const CACHE_MS = 5 * 60 * 1000;

const cache = new Map();

export class InstagramError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function igGet(path, params, { cacheKey } = {}) {
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  }
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) {
      throw new InstagramError(data.error?.message || `instagram_status_${resp.status}`, resp.status);
    }
    if (cacheKey) cache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new InstagramError("instagram_timeout", 504);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearInstagramCache(token) {
  for (const key of cache.keys()) {
    if (key.endsWith(`:${token}`)) cache.delete(key);
  }
}

export async function getProfile(token, { fresh = false } = {}) {
  return await igGet(
    "/me",
    {
      fields: "user_id,username,name,profile_picture_url,followers_count,follows_count,media_count",
      access_token: token,
    },
    { cacheKey: fresh ? undefined : `profile:${token}` }
  );
}

export async function getRecentMedia(token, limit = 12) {
  const data = await igGet(
    "/me/media",
    {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit,
      access_token: token,
    },
    { cacheKey: `media:${limit}:${token}` }
  );
  return data.data || [];
}

const toUnix = (date) => Math.floor(date.getTime() / 1000);

// Totales del día en curso (desde la medianoche local) para las métricas de interacción.
export async function getTodayInsights(igUserId, token) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const data = await igGet(
    `/${igUserId}/insights`,
    {
      metric: "reach,views,profile_views,accounts_engaged",
      period: "day",
      metric_type: "total_value",
      since: toUnix(start),
      until: toUnix(new Date()),
      access_token: token,
    },
    { cacheKey: `insights:${igUserId}:${token}` }
  );
  const out = {};
  for (const m of data.data || []) out[m.name] = m.total_value?.value ?? null;
  return {
    reach: out.reach ?? null,
    views: out.views ?? null,
    profileViews: out.profile_views ?? null,
    accountsEngaged: out.accounts_engaged ?? null,
  };
}

// Cambio neto diario de seguidores de los últimos ~30 días. Instagram solo lo da con ≥100 seguidores;
// si no está disponible devuelve [].
export async function getFollowerDeltas(igUserId, token) {
  const until = new Date();
  const since = new Date(until.getTime() - 29 * 24 * 60 * 60 * 1000);
  try {
    const data = await igGet(`/${igUserId}/insights`, {
      metric: "follower_count",
      period: "day",
      since: toUnix(since),
      until: toUnix(until),
      access_token: token,
    });
    const metric = (data.data || []).find((m) => m.name === "follower_count");
    return (metric?.values || []).map((v) => ({ date: v.end_time.slice(0, 10), delta: v.value }));
  } catch {
    return [];
  }
}

export async function refreshLongLivedToken(token) {
  const data = await igGet("/refresh_access_token", { grant_type: "ig_refresh_token", access_token: token });
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}
