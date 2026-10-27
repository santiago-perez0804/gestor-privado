import { test } from "node:test";
import assert from "node:assert/strict";
import { requestGuard, isLocalHost, isCrossSite } from "../src/middleware/requestGuard.js";

function run(guard, { method = "GET", headers = {} } = {}) {
  let status = 200;
  let body = null;
  let passed = false;
  const res = { status: (s) => ((status = s), res), json: (b) => ((body = b), res) };
  guard({ method, headers: { host: "localhost:4000", ...headers } }, res, () => (passed = true));
  return { status: passed ? 200 : status, body, passed };
}

test("hosts locales sí, dominios de internet no (DNS rebinding)", () => {
  for (const h of ["localhost:4000", "127.0.0.1:4000", "[::1]:4000", "192.168.0.15:4000", "DESKTOP-SAPO:4000", "mi-pc.local:4000"]) assert.ok(isLocalHost(h), h);
  for (const h of ["evil.com", "localhost.evil.com:4000", "abc.trycloudflare.com", ""]) assert.equal(isLocalHost(h), false, h);
});

test("pedidos de otro sitio que modifican datos: rechazados (CSRF)", () => {
  const req = (headers) => ({ headers: { host: "localhost:4000", ...headers } });
  assert.equal(isCrossSite(req({})), false, "sin Origin (curl, Electron)");
  assert.equal(isCrossSite(req({ origin: "http://localhost:4000" })), false, "la propia app");
  assert.equal(isCrossSite(req({ origin: "http://localhost:5173" })), false, "Vite en desarrollo");
  assert.equal(isCrossSite(req({ origin: "https://evil.com" })), true);
  assert.equal(isCrossSite(req({ origin: "null" })), true, "iframe con sandbox o archivo local");
  assert.equal(isCrossSite(req({ "sec-fetch-site": "cross-site" })), true);
  assert.equal(isCrossSite(req({ "sec-fetch-site": "same-site", origin: "http://evil.localhost:4000" })), true, "same-site no alcanza");
  assert.equal(isCrossSite(req({ "sec-fetch-site": "same-site", origin: "http://localhost:5173" })), false, "Vite en desarrollo");
  assert.equal(isCrossSite(req({ "sec-fetch-site": "same-origin", origin: "https://abc.trycloudflare.com" })), false, "la app por el túnel aunque el túnel cambie el Host");

  const guard = requestGuard({ authConfigured: () => false });
  assert.equal(run(guard, { method: "POST", headers: { origin: "https://evil.com" } }).status, 403);
  assert.equal(run(guard, { method: "DELETE", headers: { origin: "http://localhost:4000" } }).passed, true);
  assert.equal(run(guard, { method: "GET", headers: { origin: "https://evil.com" } }).passed, true, "leer no cambia nada (y CORS no le deja ver la respuesta)");
});

test("sin usuario y contraseña no se expone por el túnel ni a dominios ajenos", () => {
  const open = requestGuard({ authConfigured: () => false });
  const tunnel = run(open, { headers: { host: "abc.trycloudflare.com", "cf-connecting-ip": "1.2.3.4", "cf-ray": "x" } });
  assert.equal(tunnel.status, 403);
  assert.equal(tunnel.body.error, "auth_required");
  assert.equal(run(open, { headers: { host: "evil.com" } }).status, 403);
  assert.equal(run(open, { headers: { host: "192.168.0.15:4000" } }).passed, true, "la red de la casa sigue andando");

  const withAuth = requestGuard({ authConfigured: () => true });
  assert.equal(run(withAuth, { headers: { host: "abc.trycloudflare.com", "cf-ray": "x" } }).passed, true, "con usuario y contraseña el túnel sí (lo frena basicAuth)");
  assert.equal(run(withAuth, { method: "POST", headers: { host: "abc.trycloudflare.com", origin: "https://evil.com" } }).status, 403);
});
