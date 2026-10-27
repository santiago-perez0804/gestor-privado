import { useCallback, useEffect, useRef, useState } from "react";
import { workoutReducer, isDirty } from "../../../lib/fisico/index.js";
import { push, saveLocal } from "../../../lib/fisico/workoutDevice.js";

// Cambios importantes (tildar, terminar, agregar o sacar) se suben enseguida; escribir números, al ratito.
const URGENT = new Set(["toggleDone", "finish", "discard", "addExercise", "swapExercise", "removeExercise", "addSet", "removeSet", "toggleWarmup"]);
const RETRY_MS = 15_000;

/**
 * El entreno en vivo: estado (reducer puro), guardado en el celular después de CADA cambio y subida al
 * server con reintentos (al volver la conexión, al volver a la app y cada 15 s mientras quede algo).
 * @returns {{ state, dispatch, sync: { status: 'saved'|'saving'|'pending'|'offline', error: string|null }, syncNow }}
 */
export function useLiveWorkout(initial) {
  const [state, setState] = useState(initial);
  const ref = useRef(initial);
  const inflight = useRef(false);
  const timer = useRef(null);
  const [sync, setSync] = useState({ status: isDirty(initial) ? "pending" : "saved", error: null });

  const apply = useCallback((action) => {
    const next = workoutReducer(ref.current, action);
    ref.current = next;
    saveLocal(next); // primero el celular: aunque se corte todo, no se pierde
    setState(next);
    return next;
  }, []);

  const syncNow = useCallback(async () => {
    if (inflight.current) return;
    const s = ref.current;
    if (!isDirty(s)) return setSync({ status: "saved", error: null });
    inflight.current = true;
    setSync((x) => ({ ...x, status: "saving" }));
    try {
      const version = await push(s);
      apply({ type: "synced", version });
      setSync({ status: isDirty(ref.current) ? "pending" : "saved", error: null });
    } catch (err) {
      setSync({ status: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "pending", error: err.message });
    } finally {
      inflight.current = false;
      // Si mientras subía hubo cambios, otra vuelta.
      if (isDirty(ref.current)) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => syncNow(), 1500);
      }
    }
  }, [apply]);

  const dispatch = useCallback(
    (action) => {
      apply({ now: Date.now(), ...action });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => syncNow(), URGENT.has(action.type) ? 0 : 1200);
    },
    [apply, syncNow]
  );

  useEffect(() => {
    const retry = () => isDirty(ref.current) && syncNow();
    const onVisible = () => document.visibilityState === "visible" && retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(retry, RETRY_MS);
    retry();
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
      clearTimeout(timer.current);
    };
  }, [syncNow]);

  return { state, dispatch, sync, syncNow };
}
