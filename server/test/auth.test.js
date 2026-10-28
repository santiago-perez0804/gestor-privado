import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import express from "express";

// Supabase Auth falso: firma tokens con HS256 (clave vieja) o ES256 (claves nuevas, JWKS).
const SECRET = "secreto-de-prueba-que-es-largo-0123456789";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "ES256", use: "sig" };
const b64u = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function jwt(payload, { alg = "HS256" } = {}) {
  const head = b64u({ alg, typ: "JWT", ...(alg === "ES256" ? { kid: "k1" } : {}) });
  const body = b64u({ aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, ...payload });
  const data = `${head}.${body}`;
  const sig = alg === "HS256" ? createHmac("sha256", SECRET).update(data).digest() : cryptoSign("sha256", Buffer.from(data), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${data}.${sig.toString("base64url")}`;
}

const fake = { calls: [], alg: "HS256", server: null, url: "" };
before(async () => {
  fake.server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      fake.calls.push(req.url);
      const json = (o, s = 200) => (res.writeHead(s, { "Content-Type": "application/json" }), res.end(JSON.stringify(o)));
      const b = body ? JSON.parse(body) : {};
      if (req.url === "/auth/v1/.well-known/jwks.json") return json({ keys: [jwk] });
      if (req.url === "/auth/v1/token?grant_type=password") {
        if (b.password !== "bien") return json({ error: "invalid_grant" }, 400);
        return json({ access_token: jwt({ email: b.email, sub: "u1" }, { alg: fake.alg }), refresh_token: "rt-1", expires_in: 3600, user: { email: b.email } });
      }
      if (req.url === "/auth/v1/token?grant_type=refresh_token") {
        if (b.refresh_token !== "rt-1") return json({ error: "invalid_grant" }, 400);
        return json({ access_token: jwt({ email: "yo@example.com", sub: "u1" }, { alg: fake.alg }), refresh_token: "rt-2", expires_in: 3600, user: { email: "yo@example.com" } });
      }
      if (req.url.startsWith("/auth/v1/logout")) return (res.writeHead(204), res.end());
      json({ error: "unexpected" }, 404);
    });
  });
  await new Promise((r) => fake.server.listen(0, "127.0.0.1", r));
  fake.url = `http://127.0.0.1:${fake.server.address().port}`;
  Object.assign(process.env, { SUPABASE_URL: fake.url, SUPABASE_SERVICE_ROLE_KEY: "service-key", SUPABASE_JWT_SECRET: SECRET, OWNER_EMAIL: "Yo@Example.com" });
});
after(() => fake.server.close());

const { verifyAccessToken, login } = await import("../src/services/auth.js");
const { requireSession, ACCESS_COOKIE, REFRESH_COOKIE } = await import("../src/middleware/session.js");
const { default: registerAuthRoutes } = await import("../src/routes/auth.js");

test("JWT HS256: válido, vencido, adulterado y de otra persona", async () => {
  assert.equal((await verifyAccessToken(jwt({ email: "yo@example.com" }))).email, "yo@example.com");
  assert.equal(await verifyAccessToken(jwt({ email: "yo@example.com", exp: Math.floor(Date.now() / 1000) - 5 })), null, "vencido");
  const t = jwt({ email: "yo@example.com" });
  const [h, , s] = t.split(".");
  assert.equal(await verifyAccessToken(`${h}.${b64u({ email: "yo@example.com", exp: 9999999999, aud: "authenticated" })}.${s}`), null, "payload cambiado");
  assert.equal(await verifyAccessToken(jwt({ email: "otro@example.com" })), null, "no es el dueño");
  assert.equal(await verifyAccessToken(jwt({ email: "yo@example.com", aud: "anon" })), null, "otra audiencia");
  assert.equal(await verifyAccessToken("basura"), null);
  assert.equal(await verifyAccessToken(""), null);
});

test("JWT ES256 con las claves públicas del proyecto (JWKS)", async () => {
  assert.equal((await verifyAccessToken(jwt({ email: "yo@example.com" }, { alg: "ES256" }))).email, "yo@example.com");
  const t = jwt({ email: "yo@example.com" }, { alg: "ES256" });
  assert.equal(await verifyAccessToken(t.slice(0, -4) + "AAAA"), null, "firma inválida");
});

test("login: solo el dueño; mismo error para mail ajeno y contraseña mal", async () => {
  const before = fake.calls.length;
  await assert.rejects(login("otro@example.com", "bien"), { status: 401, userMessage: "Email o contraseña incorrectos." });
  assert.equal(fake.calls.length, before, "con un mail ajeno ni le pregunta a Supabase");
  await assert.rejects(login("yo@example.com", "mal"), { status: 401, userMessage: "Email o contraseña incorrectos." });
  const s = await login(" YO@example.com ", "bien");
  assert.equal(s.refreshToken, "rt-1");
});

// ---------- HTTP: cookies y middleware ----------
function app() {
  const a = express();
  a.use(express.json());
  registerAuthRoutes(a);
  a.use(requireSession());
  a.get("/api/datos", (req, res) => res.json({ ok: true, email: req.user.email }));
  a.get("/covers/x.jpg", (req, res) => res.send("img"));
  return a;
}
async function withServer(fn) {
  const srv = app().listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  try {
    return await fn(`http://127.0.0.1:${srv.address().port}`);
  } finally {
    srv.close();
  }
}
const cookiesOf = (res) => res.headers.getSetCookie();

test("sin sesión: 401 en la API y en los archivos; el estado del login es público", async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/datos`)).status, 401);
    assert.equal((await fetch(`${base}/covers/x.jpg`)).status, 401);
    const s = await (await fetch(`${base}/api/auth/session`)).json();
    assert.deepEqual(s, { authRequired: true, authenticated: false, email: null });
  });
});

test("login → cookies httpOnly y SameSite; con la cookie entra; logout las borra", async () => {
  await withServer(async (base) => {
    const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "yo@example.com", password: "mal" }) });
    assert.equal(bad.status, 401);
    const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "yo@example.com", password: "bien" }) });
    assert.equal(r.status, 200);
    const set = cookiesOf(r);
    assert.equal(set.length, 2);
    for (const c of set) assert.match(c, /HttpOnly; SameSite=Lax/);
    const jar = set.map((c) => c.split(";")[0]).join("; ");
    const ok = await (await fetch(`${base}/api/datos`, { headers: { cookie: jar } })).json();
    assert.deepEqual(ok, { ok: true, email: "yo@example.com" });
    const out = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie: jar } });
    assert.ok(cookiesOf(out).every((c) => /Max-Age=0/.test(c)));
  });
});

test("token vencido + refresh válido: se renueva solo; refresh inválido: 401 y borra cookies", async () => {
  await withServer(async (base) => {
    const expired = jwt({ email: "yo@example.com", exp: Math.floor(Date.now() / 1000) - 10 });
    const r = await fetch(`${base}/api/datos`, { headers: { cookie: `${ACCESS_COOKIE}=${expired}; ${REFRESH_COOKIE}=rt-1` } });
    assert.equal(r.status, 200);
    assert.ok(cookiesOf(r).some((c) => c.startsWith(`${REFRESH_COOKIE}=rt-2`)), "rota el refresh token");
    const gone = await fetch(`${base}/api/datos`, { headers: { cookie: `${ACCESS_COOKIE}=${expired}; ${REFRESH_COOKIE}=viejo` } });
    assert.equal(gone.status, 401);
    assert.ok(cookiesOf(gone).every((c) => /Max-Age=0/.test(c)));
  });
});

test("con https (Vercel) las cookies van con Secure", async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-proto": "https" }, body: JSON.stringify({ email: "yo@example.com", password: "bien" }) });
    assert.ok(cookiesOf(r).every((c) => /; Secure/.test(c)));
  });
});
