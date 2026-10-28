// Sesión de la web: el server guarda la sesión en cookies httpOnly (este código nunca ve los tokens).
// Acá solo se pregunta si hay sesión, se inicia y se cierra, y se avisa cuando la API dice 401.

export const UNAUTHENTICATED_EVENT = "gestor:unauthenticated";

let current = null;
/** La última sesión conocida (para mostrar "Cerrar sesión" solo si hay login). */
export const currentSession = () => current;

/** { authRequired, authenticated, email }. Sin conexión con el server, se asume que no hace falta login. */
export async function getSession() {
  try {
    const r = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return (current = { authRequired: false, authenticated: true, email: null });
    return (current = await r.json());
  } catch {
    return { authRequired: false, authenticated: true, email: null };
  }
}

export async function signIn(email, password) {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || "No se pudo iniciar sesión.");
  return data;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  window.location.assign("/");
}

/** La API respondió 401: la sesión venció o se cerró en otro lado. */
export function notifyUnauthenticated() {
  window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
}
