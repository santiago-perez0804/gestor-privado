// Trabajo que sigue después de responder (p. ej. subir a Google Calendar un cambio).
// En Vercel la función se congela al responder: waitUntil le pide que espere a que termine.
// En el server local el proceso sigue vivo, así que alcanza con no esperarlo.
export function background(promise) {
  const p = Promise.resolve(promise).catch((err) => console.warn("[background]", err?.message || err));
  if (process.env.VERCEL) {
    import("@vercel/functions")
      .then(({ waitUntil }) => waitUntil(p))
      .catch(() => {});
  }
  return p;
}
