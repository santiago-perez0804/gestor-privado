import { motion } from "framer-motion";
import { Pause } from "lucide-react";
import { formatClock, durationOf, remainingMs } from "./pomodoro.js";
import { PHASE_COLOR, ProgressRing } from "./card/PomodoroView.jsx";

/** Pastilla con el tiempo restante que flota sobre la cabeza del sapo. */
export function PomodoroBadge({ pomo, x, y, onClick }) {
  const color = PHASE_COLOR[pomo.phase];
  const left = remainingMs(pomo);
  const ratio = 1 - left / durationOf(pomo);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -100%)" }}>
      <motion.button
        data-hit
        onClick={onClick}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1"
        style={{ background: "var(--surface)", border: `1.5px solid ${color}`, boxShadow: "var(--shadow-md)", color: "var(--text)" }}
        title="Pomodoro"
      >
        <ProgressRing size={20} stroke={3} ratio={ratio} color={color}>
          {pomo.paused && <Pause size={8} />}
        </ProgressRing>
        <span className="font-mono text-xs font-semibold">{formatClock(left)}</span>
      </motion.button>
    </div>
  );
}
