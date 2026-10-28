// Biblioteca de ejercicios: la propia en español (semilla + propios) y la búsqueda en la biblioteca
// grande en inglés (free-exercise-db), que se importa como ejercicio propio con los músculos mapeados.
import { MUSCLE_IDS, EQUIPMENT_IDS } from "../../../../shared/fisico/constants.js";
import { bad, notFound, conflict, nowIso, parseJson } from "./common.js";

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const toExercise = (r) =>
  r && {
    id: r.id,
    name: r.name,
    equipment: r.equipment,
    bar: r.bar,
    isBodyweight: !!r.isBodyweight,
    muscles: parseJson(r.muscles, []),
    notes: r.notes,
    isCustom: !!r.isCustom,
    archived: !!r.archived,
    sourceLibraryId: r.sourceLibraryId ?? null,
  };

function cleanMuscles(list) {
  if (!Array.isArray(list) || !list.length) throw bad("muscles_required");
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (!MUSCLE_IDS.includes(m?.muscle) || seen.has(m.muscle)) continue;
    seen.add(m.muscle);
    out.push({ muscle: m.muscle, role: m.role === "primary" ? "primary" : "secondary" });
  }
  if (!out.some((m) => m.role === "primary")) throw bad("primary_muscle_required");
  return out;
}

// ---------- biblioteca grande (inglés) → nuestros músculos y equipos ----------
const LEGACY_MUSCLE = {
  abdominals: "abdomen",
  abductors: "gluteo",
  biceps: "biceps",
  calves: "gemelos",
  chest: "pecho",
  forearms: "antebrazo",
  glutes: "gluteo",
  hamstrings: "isquiotibiales",
  lats: "espalda",
  "lower back": "espalda",
  "middle back": "espalda",
  traps: "espalda",
  quadriceps: "cuadriceps",
  triceps: "triceps",
};
const LEGACY_EQUIPMENT = { barbell: "barra", "e-z curl bar": "barra", dumbbell: "mancuernas", cable: "polea", machine: "maquina", "body only": "peso_corporal" };

/** "shoulders" en la biblioteca grande es genérico: se decide por el nombre del ejercicio. */
function shoulderMuscle(name) {
  const n = norm(name);
  if (/lateral|side|upright/.test(n)) return "hombro_lateral";
  if (/rear|reverse fly|reverse flye|face pull|bent.over.*(raise|fly)/.test(n)) return "deltoide_posterior";
  return "hombro_anterior";
}

export function mapLegacyMuscles(row) {
  const map = (m) => (m === "shoulders" ? shoulderMuscle(row.name) : LEGACY_MUSCLE[m]);
  const out = [];
  for (const m of parseJson(row.primaryMuscles, [])) {
    const id = map(m);
    if (id && !out.some((x) => x.muscle === id)) out.push({ muscle: id, role: "primary" });
  }
  for (const m of parseJson(row.secondaryMuscles, [])) {
    const id = map(m);
    if (id && !out.some((x) => x.muscle === id)) out.push({ muscle: id, role: "secondary" });
  }
  return out;
}

export function createExercises(db) {
  /** Biblioteca propia: búsqueda por nombre (sin tildes), filtro por músculo y equipo. */
  async function list({ q, muscle, equipment, includeArchived } = {}) {
    const rows = (await db.prepare(`SELECT * FROM exercises ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY lower(name), name`).all()).map(toExercise);
    const words = norm(q).split(/\s+/).filter(Boolean);
    return rows.filter(
      (e) =>
        (!words.length || words.every((w) => norm(e.name).includes(w) || e.muscles.some((m) => norm(m.muscle).includes(w)))) &&
        (!muscle || e.muscles.some((m) => m.muscle === muscle)) &&
        (!equipment || e.equipment === equipment)
    );
  }

  async function get(id) {
    const e = toExercise(await db.prepare("SELECT * FROM exercises WHERE id = ?").get(Number(id)));
    if (!e) throw notFound();
    return e;
  }

  function clean(input, current = {}) {
    const name = String(input.name ?? current.name ?? "").trim();
    if (!name) throw bad("name_required");
    const equipment = input.equipment ?? current.equipment ?? "otro";
    if (!EQUIPMENT_IDS.includes(equipment)) throw bad("invalid_equipment");
    const bar = input.bar !== undefined ? input.bar : current.bar ?? null;
    if (bar != null && !["olimpica", "z"].includes(bar)) throw bad("invalid_bar");
    return {
      name,
      equipment,
      bar: equipment === "barra" ? bar ?? "olimpica" : null,
      isBodyweight: (input.isBodyweight ?? current.isBodyweight ?? equipment === "peso_corporal") ? 1 : 0,
      muscles: JSON.stringify(cleanMuscles(input.muscles ?? current.muscles)),
      notes: (input.notes !== undefined ? input.notes : current.notes) || null,
    };
  }

  const nameTaken = async (name, exceptId = 0) => !!await db.prepare("SELECT 1 FROM exercises WHERE lower(name) = lower(?) AND id != ?").get(name, exceptId);

  async function create(input, { sourceLibraryId = null } = {}) {
    const e = clean(input);
    if (await nameTaken(e.name)) throw conflict("name_taken");
    const ts = nowIso();
    const id = (await db
      .prepare("INSERT INTO exercises (name, equipment, bar, isBodyweight, muscles, notes, isCustom, sourceLibraryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)")
      .run(e.name, e.equipment, e.bar, e.isBodyweight, e.muscles, e.notes, sourceLibraryId, ts, ts)).lastInsertRowid;
    return await get(id);
  }

  async function update(id, input) {
    const current = await get(id);
    const e = clean(input, current);
    if (await nameTaken(e.name, current.id)) throw conflict("name_taken");
    await db.prepare("UPDATE exercises SET name = ?, equipment = ?, bar = ?, isBodyweight = ?, muscles = ?, notes = ?, archived = ?, updatedAt = ? WHERE id = ?").run(
      e.name,
      e.equipment,
      e.bar,
      e.isBodyweight,
      e.muscles,
      e.notes,
      input.archived !== undefined ? (input.archived ? 1 : 0) : current.archived ? 1 : 0,
      nowIso(),
      current.id
    );
    return await get(current.id);
  }

  /** Borrar: si se usó en una rutina o en un entreno, se archiva (no desaparece del historial). */
  async function remove(id) {
    const e = await get(id);
    const used = await db.prepare("SELECT 1 FROM routine_exercises WHERE exerciseId = ? UNION SELECT 1 FROM set_logs WHERE exerciseId = ? LIMIT 1").get(e.id, e.id);
    if (used) await db.prepare("UPDATE exercises SET archived = 1, updatedAt = ? WHERE id = ?").run(nowIso(), e.id);
    else await db.prepare("DELETE FROM exercises WHERE id = ?").run(e.id);
    return { archived: !!used };
  }

  /** Otros ejercicios que trabajan el mismo músculo primario (para "cambiar ejercicio"). */
  async function alternatives(id, limit = 8) {
    const e = await get(id);
    const primary = e.muscles.filter((m) => m.role === "primary").map((m) => m.muscle);
    return (await list())
      .filter((x) => x.id !== e.id && x.muscles.some((m) => m.role === "primary" && primary.includes(m.muscle)))
      .sort((a, b) => Number(b.equipment === e.equipment) - Number(a.equipment === e.equipment))
      .slice(0, limit);
  }

  /** Búsqueda en la biblioteca grande (inglés), con los músculos ya traducidos a los nuestros. */
  async function searchLegacy({ q, muscle, limit = 30 } = {}) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length && !muscle) return [];
    const imported = new Set((await db.prepare("SELECT sourceLibraryId FROM exercises WHERE sourceLibraryId IS NOT NULL").all()).map((r) => r.sourceLibraryId));
    const out = [];
    for (const r of await db.prepare("SELECT id, name, equipment, primaryMuscles, secondaryMuscles, category FROM exercise_library ORDER BY name").all()) {
      if (words.length && !words.every((w) => norm(r.name).includes(w))) continue;
      if (r.category && ["stretching", "cardio"].includes(r.category)) continue;
      const muscles = mapLegacyMuscles(r);
      if (!muscles.length || (muscle && !muscles.some((m) => m.muscle === muscle))) continue;
      out.push({ libraryId: r.id, name: r.name, equipment: LEGACY_EQUIPMENT[r.equipment] ?? "otro", muscles, imported: imported.has(r.id) });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Importa uno de la biblioteca grande como ejercicio propio (con nombre editable). */
  async function importLegacy(libraryId, { name } = {}) {
    const existing = await db.prepare("SELECT id FROM exercises WHERE sourceLibraryId = ?").get(libraryId);
    if (existing) return await get(existing.id);
    const r = await db.prepare("SELECT * FROM exercise_library WHERE id = ?").get(libraryId);
    if (!r) throw notFound();
    const equipment = LEGACY_EQUIPMENT[r.equipment] ?? "otro";
    return await create(
      {
        name: (name || r.name).trim(),
        equipment,
        bar: r.equipment === "e-z curl bar" ? "z" : null,
        isBodyweight: equipment === "peso_corporal",
        muscles: mapLegacyMuscles(r),
        notes: parseJson(r.instructions, []).slice(0, 2).join(" ") || null,
      },
      { sourceLibraryId: r.id }
    );
  }

  return { list, get, create, update, remove, alternatives, searchLegacy, importLegacy };
}
