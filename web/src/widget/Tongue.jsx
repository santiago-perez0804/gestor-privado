import { FlySprite } from "./Fly.jsx";

const SAMPLES = 18;
const BASE_W = 8.5;
const TIP_W = 4.5;

function quad(a, c, b, t) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/**
 * Lengua como forma rellena que se afina hacia la punta, con curva por gravedad y un
 * bamboleo que se amortigua (más fuerte al volver, como un elástico).
 */
export function Tongue({ mouth, tongue, time }) {
  const tip = { x: mouth.x + (tongue.tx - mouth.x) * tongue.p, y: mouth.y + (tongue.ty - mouth.y) * tongue.p };
  const dx = tip.x - mouth.x;
  const dy = tip.y - mouth.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const wobbleAmp = (tongue.phase === "in" ? 16 : 6) * Math.min(1, len / 120);
  const wobble = Math.sin(time * 38) * wobbleAmp * Math.max(0, 1 - tongue.t * 3);
  const ctrl = {
    x: (mouth.x + tip.x) / 2 + nx * wobble,
    y: (mouth.y + tip.y) / 2 + ny * wobble + Math.min(26, len * 0.12),
  };

  const left = [];
  const right = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = quad(mouth, ctrl, tip, t);
    const q = quad(mouth, ctrl, tip, Math.min(1, t + 0.01));
    const tx = q.x - p.x;
    const ty = q.y - p.y;
    const tl = Math.hypot(tx, ty) || 1;
    const w = (BASE_W + (TIP_W - BASE_W) * t) / 2;
    left.push(`${p.x + (-ty / tl) * w},${p.y + (tx / tl) * w}`);
    right.push(`${p.x - (-ty / tl) * w},${p.y - (tx / tl) * w}`);
  }
  const shape = `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
  const center = `M${mouth.x} ${mouth.y} Q${ctrl.x} ${ctrl.y} ${tip.x} ${tip.y}`;
  const tipR = 6.5 + (tongue.phase === "out" ? 1.2 : 0);

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      <defs>
        <linearGradient id="tongueFill" gradientUnits="userSpaceOnUse" x1={mouth.x} y1={mouth.y} x2={tip.x} y2={tip.y}>
          <stop offset="0%" stopColor="#d9475f" />
          <stop offset="100%" stopColor="#ff7f96" />
        </linearGradient>
      </defs>
      <path d={shape} fill="url(#tongueFill)" stroke="#8a2840" strokeWidth="1.8" strokeLinejoin="round" />
      <path d={center} fill="none" stroke="#ffb3c2" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" strokeDasharray={`${len * 0.55} ${len}`} />
      <circle cx={tip.x} cy={tip.y} r={tipR} fill="#ff7f96" stroke="#8a2840" strokeWidth="1.8" />
      <circle cx={tip.x - 2} cy={tip.y - 2.2} r="2" fill="#fff" opacity="0.7" />
      {tongue.carrying && (
        <foreignObject x={tip.x - 9} y={tip.y - 8} width="20" height="18">
          <FlySprite size={18} treat={tongue.treat} />
        </foreignObject>
      )}
    </svg>
  );
}
