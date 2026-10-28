// La dirección pública de la app (para las URLs de retorno de Google y Dropbox): la del .env, la de
// producción que da Vercel, o la del server local.
export function publicOrigin() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${process.env.PORT || 4000}`;
}
