import { motion } from "framer-motion";
import { X } from "lucide-react";

const BUBBLE_W = 240;

export function SpeechBubble({ bubble, frog, world, frogHeight, lift = 0, onAction, onClose }) {
  const left = Math.min(Math.max(frog.x - BUBBLE_W / 2, 8), world.width - BUBBLE_W - 8);
  const tailX = Math.min(Math.max(frog.x - left, 20), BUBBLE_W - 20);

  return (
    <div style={{ position: "absolute", left, bottom: world.height - (frog.y - frogHeight - 12) + lift, width: BUBBLE_W }}>
      <motion.div
        data-hit
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        style={{ transformOrigin: `${tailX}px 100%` }}
        className="rounded-2xl px-3.5 py-2.5 text-sm relative"
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
        />
        <span
          style={{
            position: "absolute",
            bottom: -6,
            left: tailX - 7,
            width: 14,
            height: 14,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            transform: "rotate(45deg)",
          }}
        />
        <div className="relative" style={{ color: "var(--text)" }}>
          <button
            onClick={onClose}
            className="absolute -top-1 -right-1.5 rounded-full p-0.5"
            style={{ color: "var(--text-faint)" }}
            aria-label="Cerrar"
          >
            <X size={13} />
          </button>
          <p className="pr-4 leading-snug">{bubble.text}</p>
          {bubble.actions?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {bubble.actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => onAction(a)}
                  className="text-xs font-semibold rounded-full px-3 py-1"
                  style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
