import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import registerCronRoutes from "../src/routes/cron.js";

async function call(headers = {}) {
  const app = express();
  registerCronRoutes(app);
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((r) => srv.once("listening", r));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/cron/daily`, { headers });
    return r.status;
  } finally {
    srv.close();
  }
}

test("cron: apagado sin CRON_SECRET y con un secreto equivocado no corre", async () => {
  delete process.env.CRON_SECRET;
  assert.equal(await call({ authorization: "Bearer algo" }), 503);
  process.env.CRON_SECRET = "s3cr3t";
  assert.equal(await call(), 401);
  assert.equal(await call({ authorization: "Bearer otro" }), 401);
  assert.equal(await call({ authorization: "s3cr3t" }), 401, "sin el Bearer");
  delete process.env.CRON_SECRET;
});
