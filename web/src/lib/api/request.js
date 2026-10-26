export async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `request_failed_${res.status}`);
  return data;
}

/** GET; `options.signal` permite cancelar (búsquedas mientras se escribe). */
export const get = (path, options) => request(path, options);
export const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
export const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path) => request(path, { method: "DELETE" });

export function toQuery(params) {
  const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v));
  return qs.toString();
}
