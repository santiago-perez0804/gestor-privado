import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Copy, Lightbulb, Pencil, Play, Plus, Settings2 } from "lucide-react";
import { PageTransition } from "../../components/common/PageTransition.jsx";
import { PageBar } from "../../components/common/PageBar.jsx";
import { Panel } from "../../components/common/Section.jsx";
import { MuscleChip, StatCell } from "../../components/fisico/bits.jsx";
import { ExerciseSearch } from "../../components/fisico/ExerciseSearch.jsx";
import { RoutineExercisesTable } from "../../components/fisico/RoutineExercisesTable.jsx";
import { RoutineItemModal } from "../../components/fisico/RoutineItemModal.jsx";
import { DuplicatePlanModal, PlanFormModal, RoutineFormModal } from "../../components/fisico/PlanForms.jsx";
import { WeekScheduleEditor } from "../../components/fisico/WeekScheduleEditor.jsx";
import { useApi } from "../../hooks/useApi.js";
import { api } from "../../lib/api.js";
import { num } from "../../lib/fisico/index.js";
import { muscleLabel, routineInitials, WEEKDAY_LABELS, WEEKDAY_SHORT } from "../../lib/fisico/labels.js";
import { useFisico } from "./FisicoContext.jsx";

const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0] ?? "");

/** ["biceps", "pecho"] → "Prioridad: bíceps, después pecho". */
function priorityText(priority) {
  if (!priority.length) return "Sin músculos prioritarios";
  const [first, ...rest] = priority.map((m) => muscleLabel(m).toLowerCase());
  return `Prioridad: ${first}${rest.length ? `, después ${list(rest)}` : ""}`;
}

/** Plan sin plan: crear el primero. */
function EmptyPlan({ onCreate }) {
  return (
    <Panel>
      <div className="max-w-md mx-auto text-center py-10 space-y-3">
        <p className="text-base font-semibold">Todavía no tenés un plan</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Un plan junta tus rutinas, la semana tipo y la forma de progresar. Después le cargás los ejercicios.
        </p>
        <button onClick={onCreate} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={16} /> Crear plan
        </button>
      </div>
    </Panel>
  );
}

export function PlanRutinas() {
  const { planId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { version, bump, settings } = useFisico();
  const minSets = settings?.volumeRange?.min ?? 10;
  const plansApi = useApi(() => api.getFisicoPlans(), [version]);
  const planApi = useApi(() => (planId ? api.getFisicoPlan(planId) : api.getActivePlan()), [planId, version]);
  const [modal, setModal] = useState(null); // { kind: 'plan'|'newPlan'|'duplicate'|'routine'|'newRoutine'|'item', data }
  const [searchMuscle, setSearchMuscle] = useState("");
  const [error, setError] = useState(null);

  const plan = planApi.data;
  const plans = plansApi.data || [];
  const routines = plan?.routines ?? [];
  const selectedId = Number(params.get("rutina")) || routines[0]?.id;
  const routine = routines.find((r) => r.id === selectedId) ?? routines[0];
  const reload = () => bump();

  const daysOf = (routineId) => (plan?.schedule ?? []).filter((d) => d.routineId === routineId).map((d) => d.weekday);
  const selectRoutine = (id) => setParams(id ? { rutina: String(id) } : {}, { replace: true });

  async function act(fn) {
    setError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setError(`No se pudo guardar (${err.message}).`);
    }
  }

  const addExercise = (exercise) =>
    act(() =>
      api.addRoutineItem(routine.id, {
        exerciseId: exercise.id,
        sets: 3,
        repMin: exercise.isBodyweight ? 6 : 8,
        repMax: exercise.isBodyweight ? 10 : 12,
        restSeconds: exercise.equipment === "barra" ? 150 : 90,
      })
    );

  if (planApi.loading && !plan) return null;

  const priority = plan?.priorityMuscles ?? [];
  const routineChips = routine
    ? Object.entries(routine.volume)
        .sort((a, b) => Number(priority.includes(b[0])) - Number(priority.includes(a[0])) || b[1] - a[1])
        .slice(0, 6)
    : [];
  const short = plan?.shortMuscles ?? [];

  return (
    <PageTransition className="fit:flex-1 fit:min-h-0 fit:flex fit:flex-col">
      <PageBar crumb={plan ? `Físico · ${plan.isActive ? "Plan activo" : "Plan"}` : "Físico"} title={plan ? plan.name : "Plan y rutinas"}>
        {plans.length > 1 && (
          <select value={plan?.id ?? ""} onChange={(e) => navigate(`/fisico/plan/${e.target.value}`)} aria-label="Elegir plan" className="h-9 rounded-lg px-2 text-sm max-w-48">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isActive ? " (activo)" : ""}
              </option>
            ))}
          </select>
        )}
        {plan && (
          <>
            <button onClick={() => setModal({ kind: "plan" })} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }} aria-label="Editar plan">
              <Settings2 size={15} />
              <span className="max-sm:hidden">Editar plan</span>
            </button>
            <button onClick={() => setModal({ kind: "duplicate" })} className="hover-surface flex items-center gap-1.5 h-9 px-3 text-sm" style={{ border: "1px solid var(--border)" }}>
              <Copy size={15} />
              <span className="max-sm:hidden">Duplicar plan</span>
            </button>
            <button onClick={() => setModal({ kind: "newRoutine" })} className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              <Plus size={15} /> Nueva rutina
            </button>
          </>
        )}
      </PageBar>

      {!plan ? (
        <EmptyPlan onCreate={() => setModal({ kind: "newPlan" })} />
      ) : (
        <div className="space-y-4 lg:space-y-0 fit:flex-1 fit:min-h-0 fit:flex fit:flex-col">
          {!plan.isActive && (
            <p className="flex flex-wrap items-center gap-2 text-sm rounded-xl px-4 py-2.5 lg:rounded-none lg:px-7 fit:shrink-0" style={{ background: "color-mix(in srgb, var(--status-warning) 10%, transparent)" }}>
              Este plan no es el activo.
              <button onClick={() => act(() => api.activatePlan(plan.id))} className="ghost-action font-semibold px-1" style={{ color: "var(--accent-strong)" }}>
                Hacerlo activo
              </button>
            </p>
          )}
          <section className="fit:shrink-0 grid gap-3 grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:border-b lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0">
            <StatCell label="Objetivo" value={plan.goal || "Sin objetivo"} sub={priorityText(priority)} />
            <StatCell label="Duración" value={plan.currentWeek ? `Semana ${Math.min(plan.currentWeek, plan.weeks || plan.currentWeek)}${plan.weeks ? ` de ${plan.weeks}` : ""}` : plan.startDate ? "Empieza pronto" : "Sin fecha de inicio"}>
              {plan.currentWeek && plan.weeks ? (
                <span className="block h-1.5 rounded-full mt-2" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(1, plan.currentWeek / plan.weeks) * 100}%`, background: "var(--accent)" }} />
                </span>
              ) : (
                <button onClick={() => setModal({ kind: "plan" })} className="ghost-action text-xs font-semibold mt-1 px-1 -mx-1" style={{ color: "var(--accent-strong)" }}>
                  Poner fechas
                </button>
              )}
            </StatCell>
            <StatCell label="Progresión" value="Doble progresión" sub="Tope de reps en todas las series → +peso" />
            <StatCell label="Descarga" value={plan.deloadWeek ? `Semana ${plan.deloadWeek}${plan.isDeloadWeek ? " · es esta" : ""}` : "Sin descarga"} sub={plan.deloadWeek ? "Mitad de series, mismo peso" : null} />
          </section>

          <Panel className="lg:border-b fit:shrink-0">
            <h2 className="text-[15px] font-semibold mb-3">Tu semana tipo</h2>
            <WeekScheduleEditor key={`${plan.id}-${version}`} plan={plan} onChanged={reload} />
          </Panel>

          {/* Con alto fijo (fit): solo scrollean la lista de rutinas y la de ejercicios. */}
          <div className="grid gap-4 lg:gap-0 lg:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)] fit:flex-1 fit:min-h-0 fit:grid-rows-[minmax(0,1fr)]">
            <Panel className="lg:border-r fit:flex fit:flex-col fit:min-h-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 fit:shrink-0" style={{ color: "var(--text-faint)" }}>
                Rutinas · {routines.length}
              </p>
              {routines.length ? (
                <ul className="thin-scroll space-y-2 max-lg:flex max-lg:gap-2 max-lg:space-y-0 max-lg:overflow-x-auto no-scrollbar-mobile fit:min-h-0 fit:overflow-y-auto fit:-mr-3 fit:pr-3">
                  {routines.map((r) => {
                    const on = r.id === routine?.id;
                    const days = daysOf(r.id);
                    return (
                      <li key={r.id} className="max-lg:shrink-0 max-lg:w-48">
                        <button onClick={() => selectRoutine(r.id)} aria-current={on ? "true" : undefined} className="card-hover w-full flex items-center gap-3 rounded-xl p-3 text-left" style={{ border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-soft)" : undefined }}>
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-semibold shrink-0" style={{ background: on ? "var(--accent)" : "var(--surface-alt)", color: on ? "var(--on-accent)" : "var(--text-muted)" }}>
                            {routineInitials(r.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold truncate">{r.name}</span>
                            <span className="block text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
                              {[days.map((d) => WEEKDAY_SHORT[d]).join(" y "), `${r.exerciseCount} ejercicios`, `${r.setCount} series`].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <button onClick={() => setModal({ kind: "newRoutine" })} className="card-hover w-full rounded-xl p-4 text-sm text-left" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                  Creá tu primera rutina (por ejemplo Push A, Pull A, Legs).
                </button>
              )}
            </Panel>

            <Panel className="fit:flex fit:flex-col fit:min-h-0">
              {routine ? (
                <div className="space-y-4 fit:flex fit:flex-col fit:min-h-0">
                  <div className="flex items-start gap-3 fit:shrink-0">
                    <div className="min-w-0 mr-auto">
                      <h2 className="text-xl font-semibold truncate">
                        {routine.name}
                        {daysOf(routine.id).length > 0 && <span style={{ color: "var(--text-muted)" }}> · {daysOf(routine.id).map((d) => WEEKDAY_LABELS[d].toLowerCase()).join(" y ")}</span>}
                      </h2>
                      {routine.description && (
                        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {routine.description}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setModal({ kind: "routine", data: routine })} aria-label="Editar rutina" className="hover-surface w-10 h-10 flex items-center justify-center shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <Pencil size={15} />
                    </button>
                    <Link to={`/fisico/entreno?rutina=${routine.id}`} className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold shrink-0" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                      <Play size={15} /> Empezar
                    </Link>
                  </div>
                  {routineChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 fit:shrink-0">
                      {routineChips.map(([m, v]) => (
                        <MuscleChip key={m} muscle={m} value={v} priority={priority.includes(m)} />
                      ))}
                    </div>
                  )}
                  <RoutineExercisesTable
                    items={routine.items}
                    onReorder={(ids) => act(() => api.reorderRoutineItems(routine.id, ids))}
                    onEdit={(it) => setModal({ kind: "item", data: it })}
                    onRemove={(it) => act(() => api.deleteRoutineItem(it.id))}
                  />
                  <p className="text-[11px] fit:shrink-0" style={{ color: "var(--text-faint)" }}>
                    Esfuerzo en RIR: repeticiones que te quedaban en reserva. RIR 1–2 = cerca del fallo sin llegar.
                  </p>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start fit:shrink-0">
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                        Agregar ejercicio
                      </p>
                      <ExerciseSearch onPick={addExercise} muscle={searchMuscle} dropUp />
                    </div>
                    {short.length > 0 && (
                      <div className="flex gap-2.5 rounded-xl p-3.5 text-sm" style={{ background: "color-mix(in srgb, var(--status-warning) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)" }}>
                        <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: "var(--status-warning)" }} />
                        <p>
                          <b>
                            {list(short.map((m) => `${muscleLabel(m.muscle).toLowerCase()} (${num(m.planned)})`))} {short.length === 1 ? "queda" : "quedan"} bajo {minSets} series por semana.
                          </b>{" "}
                          Sumá series de {muscleLabel(short[0].muscle).toLowerCase()} en alguna rutina.{" "}
                          <button onClick={() => setSearchMuscle(short[0].muscle)} className="ghost-action font-semibold px-1" style={{ color: "var(--accent-strong)" }}>
                            Agregar
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Elegí o creá una rutina para cargarle ejercicios.
                </p>
              )}
              {error && (
                <p className="text-sm mt-3" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}

      {modal?.kind === "plan" && <PlanFormModal plan={plan} onClose={() => setModal(null)} onSaved={reload} onDeleted={() => (navigate("/fisico/plan"), reload())} />}
      {modal?.kind === "newPlan" && <PlanFormModal onClose={() => setModal(null)} onSaved={(p) => (navigate(`/fisico/plan/${p.id}`), reload())} />}
      {modal?.kind === "duplicate" && <DuplicatePlanModal plan={plan} onClose={() => setModal(null)} onSaved={(p) => (navigate(`/fisico/plan/${p.id}`), reload())} />}
      {modal?.kind === "newRoutine" && <RoutineFormModal planId={plan.id} onClose={() => setModal(null)} onSaved={(r) => (selectRoutine(r.id), reload())} />}
      {modal?.kind === "routine" && <RoutineFormModal planId={plan.id} routine={modal.data} onClose={() => setModal(null)} onSaved={reload} onDeleted={() => (selectRoutine(null), reload())} />}
      {modal?.kind === "item" && <RoutineItemModal item={modal.data} onClose={() => setModal(null)} onSaved={reload} />}
    </PageTransition>
  );
}
