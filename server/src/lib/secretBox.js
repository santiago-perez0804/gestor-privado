// Cifrado de secretos guardados en la base (p. ej. el refresh token de Google): AES-256-GCM con la
// clave TOKEN_ENCRYPTION_KEY del .env. Si alguien copia la base, sin el .env no puede leer los tokens.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyFrom(base64) {
  const key = Buffer.from(base64 || "", "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY tiene que ser de 32 bytes en base64");
  return key;
}

/** ¿Hay una clave válida configurada? */
export function hasEncryptionKey(base64 = process.env.TOKEN_ENCRYPTION_KEY) {
  try {
    keyFrom(base64);
    return true;
  } catch {
    return false;
  }
}

/** Texto → "v1:iv:tag:cifrado" (todo en base64). */
export function encryptSecret(plain, base64Key = process.env.TOKEN_ENCRYPTION_KEY) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Inverso de encryptSecret. Falla si el texto fue alterado o la clave no es la misma. */
export function decryptSecret(boxed, base64Key = process.env.TOKEN_ENCRYPTION_KEY) {
  const [version, iv, tag, data] = String(boxed).split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("secreto con formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
