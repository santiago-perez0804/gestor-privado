// Medidas: sesiones de medición (todas las zonas juntas), evolución por zona según la dirección que
// "va bien", relaciones (hombros ÷ cintura, cintura ÷ altura) y cuándo toca medir de nuevo.
import { ZONES, ZONE_IDS, LEGACY_ZONES } from "../../../../shared/fisico/constants.js";
import { byZone, zoneTrend, ratios, nextDue } from "../../../../shared/fisico/measurements.js";
import { bad, notFound, nowIso, getSettings, today } from "./common.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN = { ...ZONES, ...LEGACY_ZONES };

export function createMeasurements(db) {
  const all = async () => await db.prepare("SELECT id, sessionId, measuredOn, zone, valueCm FROM measurements ORDER BY measuredOn, id").all();

  async function summary() {
    const settings = await getSettings(db);
    const rows = await all();
    const zones = byZone(rows);
    const shown = [...ZONE_IDS, ...Object.keys(LEGACY_ZONES).filter((z) => zones[z]?.length)];
    const sessions = (await db
      .prepare("SELECT id, measuredOn, notes FROM measurement_sessions ORDER BY measuredOn DESC, id DESC")
      .all())
      .map((s) => ({ ...s, values: Object.fromEntries(rows.filter((r) => r.sessionId === s.id).map((r) => [r.zone, { id: r.id, valueCm: r.valueCm }])) }))
      .filter((s) => Object.keys(s.values).length);
    const last = sessions[0]?.measuredOn ?? null;
    return {
      zones: shown.map((z) => ({
        zone: z,
        label: KNOWN[z].label,
        how: KNOWN[z].how,
        direction: settings.zoneDirection[z] ?? "neutral",
        series: zones[z] ?? [],
        trend: zoneTrend(zones[z], settings.zoneDirection[z] ?? "neutral"),
      })),
      ratios: ratios(zones, settings.heightCm),
      heightCm: settings.heightCm,
      next: nextDue(last, settings.measureEveryDays, await today(db)),
      everyDays: settings.measureEveryDays,
      sessions,
    };
  }

  /** Guarda una medición completa: { measuredOn, values: { cintura: 96.5, … }, notes }. */
  async function saveSession({ measuredOn, values, notes } = {}) {
    const day = measuredOn || await today(db);
    if (!DATE.test(day)) throw bad("invalid_date");
    const entries = Object.entries(values || {}).filter(([, v]) => v != null && v !== "");
    if (!entries.length) throw bad("values_required");
    for (const [zone, v] of entries) {
      if (!KNOWN[zone]) throw bad("invalid_zone");
      if (!(Number(v) > 10 && Number(v) < 300)) throw bad("invalid_value");
    }
    const ts = nowIso();
    return await db.tx(async () => {
      const id = Number((await db.prepare("INSERT INTO measurement_sessions (measuredOn, notes, createdAt) VALUES (?, ?, ?)").run(day, notes || null, ts)).lastInsertRowid);
      const ins = db.prepare("INSERT INTO measurements (sessionId, measuredOn, zone, valueCm, createdAt) VALUES (?, ?, ?, ?, ?)");
      for (const [zone, v] of entries) await ins.run(id, day, zone, Math.round(Number(v) * 10) / 10, ts);
      return id;
    });
  }

  async function updateValue(id, { valueCm }) {
    const row = await db.prepare("SELECT id FROM measurements WHERE id = ?").get(Number(id));
    if (!row) throw notFound();
    if (!(Number(valueCm) > 10 && Number(valueCm) < 300)) throw bad("invalid_value");
    await db.prepare("UPDATE measurements SET valueCm = ? WHERE id = ?").run(Math.round(Number(valueCm) * 10) / 10, row.id);
  }

  async function removeValue(id) {
    const row = await db.prepare("SELECT sessionId FROM measurements WHERE id = ?").get(Number(id));
    if (!row) return;
    await db.prepare("DELETE FROM measurements WHERE id = ?").run(Number(id));
    // Una sesión sin medidas no sirve.
    if (!await db.prepare("SELECT 1 FROM measurements WHERE sessionId = ?").get(row.sessionId)) await db.prepare("DELETE FROM measurement_sessions WHERE id = ?").run(row.sessionId);
  }

  const removeSession = async (id) => await db.prepare("DELETE FROM measurement_sessions WHERE id = ?").run(Number(id));

  return { summary, saveSession, updateValue, removeValue, removeSession };
}
