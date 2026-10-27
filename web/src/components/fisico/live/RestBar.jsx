import { useEffect, useRef, useState } from "react";
import { restRemaining } from "../../../lib/fisico/index.js";
import { restDoneAlarm } from "../../../lib/fisico/workoutDevice.js";

const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/**
 * Descanso: cuenta regresiva calculada con el reloj (endsAt), así sigue bien aunque la pantalla se
 * bloquee o la pestaña quede en segundo plano. Al llegar a 0 suena (y vibra/notifica si se puede).
 */
export function RestBar({ rest, onAdjust, onSkip }) {
  const [now, setNow] = useState(() => Date.now());
  const alarmed = useRef(null);
  useEffect(() => {
    if (!rest) return;
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [rest]);

  const left = restRemaining(rest, now);
  useEffect(() => {
    if (!rest || left > 0 || alarmed.current === rest.setId) return;
    alarmed.current = rest.setId;
    // Si terminó hace rato (la app estuvo dormida), no suena al volver: solo se muestra.
    if (now - rest.endsAt < 5000) restDoneAlarm();
  }, [rest, left, now]);

  if (!rest) return null;
  const done = left <= 0;
  const total = Math.max(1, (rest.endsAt - rest.startedAt) / 1000);
  const ratio = Math.min(1, Math.max(0, 1 - left / total));
  const btn = "h-12 min-w-12 px-3 rounded-xl text-base font-semibold";
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className={`max-w-md mx-auto rounded-2xl p-3.5 ${done ? "rest-done" : ""}`} style={{ background: "var(--surface)", border: `1px solid ${done ? "var(--accent)" : "var(--border)"}`, boxShadow: "0 -10px 40px -20px rgba(0,0,0,.6)" }} role="timer" aria-live="polite">
        <div className="flex items-center gap-2">
          <div className="mr-auto">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {done ? "¡A la siguiente serie!" : "Descanso"}
            </p>
            <p className="font-mono text-4xl font-semibold leading-none mt-0.5" aria-label={`Quedan ${Math.max(0, left)} segundos`}>
              {mmss(left)}
            </p>
          </div>
          <button onClick={() => onAdjust(-15)} className={`${btn} hover-surface`} style={{ background: "var(--surface-alt)" }}>
            −15
          </button>
          <button onClick={() => onAdjust(15)} className={`${btn} hover-surface`} style={{ background: "var(--surface-alt)" }}>
            +15
          </button>
          <button onClick={onSkip} className={btn} style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            {done ? "Listo" : "Saltar"}
          </button>
        </div>
        <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
          <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: "var(--accent)", transition: "width .25s linear" }} />
        </div>
      </div>
    </div>
  );
}
