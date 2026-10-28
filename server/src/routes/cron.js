// Tarea diaria que llama Vercel Cron. No usa la sesión: Vercel manda "Authorization: Bearer <CRON_SECRET>".
import { timingSafeEqual } from "node:crypto";
import { runDaily } from "../services/cron.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(String(req.headers.authorization || ""));
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export default function registerCronRoutes(app) {
  app.get("/api/cron/daily", async (req, res) => {
    if (!process.env.CRON_SECRET) return res.status(503).json({ error: "cron_not_configured" });
    if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
    res.json({ ok: true, results: await runDaily() });
  });
}
