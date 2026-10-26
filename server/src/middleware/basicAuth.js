import { timingSafeEqual } from "node:crypto";

function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * HTTP Basic Auth, activado solo si AUTH_USER/AUTH_PASS están seteadas.
 * En desarrollo local (sin esas variables) no hace nada.
 */
export function basicAuth(req, res, next) {
  const expectedUser = process.env.AUTH_USER;
  const expectedPass = process.env.AUTH_PASS;
  if (!expectedUser || !expectedPass) return next();

  const header = req.headers.authorization;
  if (header && header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const sepIndex = decoded.indexOf(":");
    const user = decoded.slice(0, sepIndex);
    const pass = decoded.slice(sepIndex + 1);
    if (safeCompare(user, expectedUser) && safeCompare(pass, expectedPass)) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Fisico"');
  res.status(401).send("Autenticación requerida.");
}
