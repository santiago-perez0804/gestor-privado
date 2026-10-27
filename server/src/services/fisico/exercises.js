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
  function list({ q, muscle, equipment, includeArchived } = {}) {
    const rows = db.prepare(`SELECT * FROM exercises ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY name COLLATE NOCASE`).all().map(toExercise);
    const words = norm(q).split(/\s+/).filter(Boolean);
    return rows.filter(
      (e) =>
        (!words.length || words.every((w) => norm(e.name).includes(w) || e.muscles.some((m) => norm(m.muscle).includes(w)))) &&
        (!muscle || e.muscles.some((m) => m.muscle === muscle)) &&
        (!equipment || e.equipment === equipment)
    );
  }

  function get(id) {
    const e = toExercise(db.prepare("SELECT * FROM exercises WHERE id = ?").get(Number(id)));
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

  const nameTaken = (name, exceptId = 0) => !!db.prepare("SELECT 1 FROM exercises WHERE name = ? COLLATE NOCASE AND id != ?").get(name, exceptId);

  function create(input, { sourceLibraryId = null } = {}) {
    const e = clean(input);
    if (nameTaken(e.name)) throw conflict("name_taken");
    const ts = nowIso();
    const id = db
      .prepare("INSERT INTO exercises (name, equipment, bar, isBodyweight, muscles, notes, isCustom, sourceLibraryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)")
      .run(e.name, e.equipment, e.bar, e.isBodyweight, e.muscles, e.notes, sourceLibraryId, ts, ts).lastInsertRowid;
    return get(id);
  }

  function update(id, input) {
    const current = get(id);
    const e = clean(input, current);
    if (nameTaken(e.name, current.id)) throw conflict("name_taken");
    db.prepare("UPDATE exercises SET name = ?, equipment = ?, bar = ?, isBodyweight = ?, muscles = ?, notes = ?, archived = ?, updatedAt = ? WHERE id = ?").run(
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
    return get(current.id);
  }

  /** Borrar: si se usó en una rutina o en un entreno, se archiva (no desaparece del historial). */
  function remove(id) {
    const e = get(id);
    const used = db.prepare("SELECT 1 FROM routine_exercises WHERE exerciseId = ? UNION SELECT 1 FROM set_logs WHERE exerciseId = ? LIMIT 1").get(e.id, e.id);
    if (used) db.prepare("UPDATE exercises SET archived = 1, updatedAt = ? WHERE id = ?").run(nowIso(), e.id);
    else db.prepare("DELETE FROM exercises WHERE id = ?").run(e.id);
    return { archived: !!used };
  }

  /** Otros ejercicios que trabajan el mismo músculo primario (para "cambiar ejercicio"). */
  function alternatives(id, limit = 8) {
    const e = get(id);
    const primary = e.muscles.filter((m) => m.role === "primary").map((m) => m.muscle);
    return list()
      .filter((x) => x.id !== e.id && x.muscles.some((m) => m.role === "primary" && primary.includes(m.muscle)))
      .sort((a, b) => Number(b.equipment === e.equipment) - Number(a.equipment === e.equipment))
      .slice(0, limit);
  }

  /** Búsqueda en la biblioteca grande (inglés), con los músculos ya traducidos a los nuestros. */
  function searchLegacy({ q, muscle, limit = 30 } = {}) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length && !muscle) return [];
    const imported = new Set(db.prepare("SELECT sourceLibraryId FROM exercises WHERE sourceLibraryId IS NOT NULL").all().map((r) => r.sourceLibraryId));
    const out = [];
    for (const r of db.prepare("SELECT id, name, equipment, primaryMuscles, secondaryMuscles, category FROM exercise_library ORDER BY name").iterate()) {
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
  function importLegacy(libraryId, { name } = {}) {
    const existing = db.prepare("SELECT id FROM exercises WHERE sourceLibraryId = ?").get(libraryId);
    if (existing) return get(existing.id);
    const r = db.prepare("SELECT * FROM exercise_library WHERE id = ?").get(libraryId);
    if (!r) throw notFound();
    const equipment = LEGACY_EQUIPMENT[r.equipment] ?? "otro";
    return create(
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
