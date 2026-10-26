import { Pause, Play, SkipForward, Square } from "lucide-react";
import { PHASE_LABEL, durationOf, formatClock, isRunning, remainingMs } from "../pomodoro.js";
import { ViewHeader, Chip } from "./ui.jsx";

export const PHASE_COLOR = { focus: "#ef5b5b", short: "#22b07d", long: "#2f9bd6", idle: "#9aa3ad", ready: "#9aa3ad" };

export function ProgressRing({ size, stroke, ratio, color, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-alt)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 0.5s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function RoundButton({ icon: Icon, onClick, primary, label, color }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-full flex items-center justify-center transition-transform hover:scale-105"
      style={{
        width: primary ? 52 : 40,
        height: primary ? 52 : 40,
        background: primary ? color : "var(--surface-alt)",
        color: primary ? "#fff" : "var(--text-muted)",
        boxShadow: primary ? "var(--shadow-md)" : "none",
      }}
    >
      <Icon size={primary ? 20 : 16} fill={primary ? "currentColor" : "none"} />
    </button>
  );
}

export function PomodoroView({ ctl }) {
  const { pomo } = ctl;
  const running = isRunning(pomo);
  const color = PHASE_COLOR[pomo.phase];
  const total = running ? durationOf(pomo) : durationOf(pomo, "focus");
  const left = running ? remainingMs(pomo) : total;
  const ratio = running ? 1 - left / total : 0;
  const todayCount = pomo.today.count;

  return (
    <div>
      <ViewHeader title="Pomodoro" onBack={() => ctl.setView("home")} />
      <div className="flex flex-col items-center gap-3">
        <ProgressRing size={150} stroke={9} ratio={ratio} color={color}>
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
            {PHASE_LABEL[pomo.phase]}
          </span>
          <span className="text-3xl font-mono font-semibold">{formatClock(left)}</span>
          {pomo.paused && (
            <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
              en pausa
            </span>
          )}
        </ProgressRing>

        <div className="flex items-center gap-3">
          {running && <RoundButton icon={Square} label="Terminar" onClick={ctl.pomoStop} />}
          {!running ? (
            <RoundButton icon={Play} primary color={PHASE_COLOR.focus} label="Empezar foco" onClick={ctl.pomoStart} />
          ) : pomo.paused ? (
            <RoundButton icon={Play} primary color={color} label="Seguir" onClick={ctl.pomoResume} />
          ) : (
            <RoundButton icon={Pause} primary color={color} label="Pausar" onClick={ctl.pomoPause} />
          )}
          {running && <RoundButton icon={SkipForward} label="Saltar fase" onClick={ctl.pomoSkip} />}
        </div>

        <div className="flex items-center gap-1" title="Pomodoros completados hoy">
          {Array.from({ length: Math.max(4, todayCount) }, (_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{ width: 9, height: 9, background: i < todayCount ? PHASE_COLOR.focus : "var(--surface-alt)" }}
            />
          ))}
          <span className="text-[11px] ml-1.5" style={{ color: "var(--text-muted)" }}>
            {todayCount} hoy
          </span>
        </div>

        <div className="w-full flex flex-col gap-1.5 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Foco
          </span>
          <div className="flex items-center gap-1.5">
            {[15, 25, 45, 50].map((m) => (
              <Chip key={m} active={pomo.settings.focus === m} color={PHASE_COLOR.focus} onClick={() => ctl.pomoSettings({ focus: m })}>
                {m} min
              </Chip>
            ))}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Descanso
          </span>
          <div className="flex items-center gap-1.5">
            {[5, 10].map((m) => (
              <Chip key={m} active={pomo.settings.short === m} color={PHASE_COLOR.short} onClick={() => ctl.pomoSettings({ short: m })}>
                {m} min
              </Chip>
            ))}
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-faint)" }}>
              largo: {pomo.settings.long} min
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
