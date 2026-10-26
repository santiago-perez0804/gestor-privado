import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret, hasEncryptionKey } from "../src/lib/secretBox.js";

const key = randomBytes(32).toString("base64");

test("cifra y descifra un token", () => {
  const boxed = encryptSecret("1//refresh-token-de-prueba", key);
  assert.notEqual(boxed, "1//refresh-token-de-prueba");
  assert.equal(decryptSecret(boxed, key), "1//refresh-token-de-prueba");
});

test("cada cifrado es distinto (IV aleatorio)", () => {
  assert.notEqual(encryptSecret("x", key), encryptSecret("x", key));
});

test("falla con otra clave o si se altera el texto", () => {
  const boxed = encryptSecret("secreto", key);
  assert.throws(() => decryptSecret(boxed, randomBytes(32).toString("base64")));
  const parts = boxed.split(":");
  parts[3] = Buffer.from("otra cosa").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":"), key));
});

test("valida la clave", () => {
  assert.equal(hasEncryptionKey(key), true);
  assert.equal(hasEncryptionKey("corta"), false);
  assert.equal(hasEncryptionKey(undefined), false);
});
