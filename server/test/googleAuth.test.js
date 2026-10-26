import { test, before } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { createGoogleAuth, createCalendarClient, googleConfigured } from "../src/services/google/calendarClient.js";
import { getAccount } from "../src/services/google/sync.js";

before(() => {
  process.env.GOOGLE_CLIENT_ID = "cliente.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "secreto";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:4000/api/google/callback";
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

const jsonResponse = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: { get: (h) => headers[h.toLowerCase()] ?? null } });
const idToken = (email) => `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(ocioSchema);
  return db;
}

test("arma la URL de consentimiento con scope mínimo, refresh token y state", () => {
  assert.equal(googleConfigured(), true);
  const auth = createGoogleAuth(freshDb());
  const url = new URL(auth.authUrl());
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.match(url.searchParams.get("scope"), /calendar\.app\.created/);
  assert.match(url.searchParams.get("state"), /^[0-9a-f]{32}$/);
});

test("callback: rechaza un state desconocido y guarda el refresh token cifrado", async () => {
  const db = freshDb();
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push([String(url), opts?.body?.toString()]);
    return jsonResponse(200, { access_token: "ya29.a", refresh_token: "1//refresco", expires_in: 3600, id_token: idToken("yo@gmail.com") });
  };
  const auth = createGoogleAuth(db, { fetchImpl });
  await assert.rejects(auth.handleCallback({ code: "c", state: "inventado" }), /invalid_state/);
  const state = new URL(auth.authUrl()).searchParams.get("state");
  const account = await auth.handleCallback({ code: "4/codigo", state });
  assert.equal(account.email, "yo@gmail.com");
  assert.equal(account.status, "connected");
  assert.ok(!account.refreshTokenEnc.includes("refresco"), "el token no queda en claro en la base");
  assert.match(calls[0][1], /grant_type=authorization_code/);
  await assert.rejects(auth.handleCallback({ code: "otra vez", state }), /invalid_state/, "el state no se puede reusar");
});

test("renueva el token de acceso y, si Google lo revocó, marca la cuenta para reconectar", async () => {
  const db = freshDb();
  let mode = "callback";
  const fetchImpl = async () => {
    if (mode === "callback") return jsonResponse(200, { access_token: "a1", refresh_token: "r1", expires_in: 1, id_token: idToken("yo@gmail.com") });
    if (mode === "refresh") return jsonResponse(200, { access_token: "a2", expires_in: 3600 });
    return jsonResponse(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
  };
  const auth = createGoogleAuth(db, { fetchImpl });
  await auth.handleCallback({ code: "c", state: new URL(auth.authUrl()).searchParams.get("state") });
  mode = "refresh";
  assert.equal(await auth.getAccessToken(), "a2", "el primero vencía enseguida: pide uno nuevo");
  assert.equal(await auth.getAccessToken(), "a2", "y lo reusa mientras sirva");
  mode = "revoked";
  await assert.rejects(auth.getAccessToken({ force: true }), (e) => e.code === "invalid_grant");
  assert.equal(getAccount(db).status, "revoked");
});

test("cliente de Calendar: reintenta con token nuevo ante 401 y propaga el 412", async () => {
  const tokens = [];
  const getAccessToken = async ({ force } = {}) => {
    tokens.push(force ? "nuevo" : "viejo");
    return force ? "nuevo" : "viejo";
  };
  let n = 0;
  const fetchImpl = async (url, opts) => {
    n += 1;
    if (n === 1) return jsonResponse(401, { error: { message: "Invalid Credentials" } });
    if (opts.headers["If-Match"] === '"viejo"') return jsonResponse(412, { error: { message: "Precondition Failed" } });
    return jsonResponse(200, { id: "ev1", etag: '"e2"', headerToken: opts.headers.Authorization });
  };
  const client = createCalendarClient(getAccessToken, { fetchImpl, backoff: () => 0 });
  const ev = await client.insertEvent("cal", { summary: "x" });
  assert.equal(ev.headerToken, "Bearer nuevo");
  assert.deepEqual(tokens, ["viejo", "nuevo"]);
  await assert.rejects(client.patchEvent("cal", "ev1", { summary: "y" }, '"viejo"'), (e) => e.status === 412);
});
