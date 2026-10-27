// Protecciones de la API frente a otros sitios web y a exponerla sin querer.
//
// 1) CSRF (siempre): un pedido que modifica datos (POST/PUT/PATCH/DELETE) que viene de OTRO sitio
//    (otro Origin) se rechaza. Sin esto, cualquier página abierta en el navegador podría mandar un
//    formulario a localhost:4000 y, por ejemplo, subir archivos o borrar cosas.
// 2) Sin usuario y contraseña (app de escritorio, desarrollo) el server es solo para este equipo y
//    la red de la casa:
//    - lo que llega por el túnel de Cloudflare se rechaza (exponerlo a internet exige AUTH_USER/AUTH_PASS);
//    - "DNS rebinding": un dominio de internet que apunta a 127.0.0.1 no puede leer la API. Solo se
//      acepta un Host local (localhost, una IP o un nombre de la red local).

export const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** ¿El Host es de este equipo o de la red local? (no un dominio de internet). */
export function isLocalHost(hostHeader) {
  const raw = String(hostHeader || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw.startsWith("[")) return true; // IPv6 literal, p. ej. [::1]:4000
  const host = raw.replace(/:\d+$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  return !host.includes("."); // nombre de equipo de la red local (no se puede registrar en internet)
}

/**
 * ¿El pedido viene de otro sitio? (para los que modifican datos).
 * Los navegadores mandan Sec-Fetch-Site (una página no lo puede falsificar) y no depende del Host,
 * que un túnel puede reescribir; si no viene (navegadores viejos), se compara Origin con Host.
 */
export function isCrossSite(req) {
  const site = req.headers["sec-fetch-site"];
  if (site === "same-origin" || site === "none") return false;
  if (site) return !DEV_ORIGINS.includes(req.headers.origin); // same-site / cross-site: solo el Vite de desarrollo
  const origin = req.headers.origin;
  if (!origin) return false; // sin Origin: no lo mandó un navegador desde otra página (curl, el propio Electron)
  if (origin === "null") return true;
  let o;
  try {
    o = new URL(origin);
  } catch {
    return true;
  }
  return o.host !== String(req.headers.host || "").toLowerCase() && !DEV_ORIGINS.includes(o.origin);
}

export function requestGuard({ authConfigured = () => !!(process.env.AUTH_USER && process.env.AUTH_PASS) } = {}) {
  return (req, res, next) => {
    if (!authConfigured()) {
      if (req.headers["cf-connecting-ip"] || req.headers["cf-ray"])
        return res.status(403).json({ error: "auth_required", message: "Para usar la app desde internet configurá AUTH_USER y AUTH_PASS (ver .env.example)." });
      if (!isLocalHost(req.headers.host)) return res.status(403).json({ error: "host_not_allowed" });
    }
    if (!SAFE_METHODS.has(req.method) && isCrossSite(req)) return res.status(403).json({ error: "cross_site_request" });
    next();
  };
}

/** Cabeceras básicas: no adivinar tipos de archivo, no dejarse meter en un iframe ajeno. */
export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
}
