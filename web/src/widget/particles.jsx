// Partículas livianas (corazones, brillitos, textos "+5", notas) en coordenadas de pantalla.
let nextId = 1;
const rand = (a, b) => a + Math.random() * (b - a);

export function spawn(list, kind, x, y, { count = 1, text, color } = {}) {
  for (let i = 0; i < count; i++) {
    list.push({
      id: nextId++,
      kind,
      text,
      color,
      x: x + rand(-14, 14),
      y: y + rand(-6, 6),
      vx: rand(-28, 28),
      vy: kind === "text" ? -46 : rand(-90, -50),
      life: 0,
      max: kind === "text" ? 1.4 : rand(1, 1.6),
      rot: rand(-20, 20),
      scale: rand(0.8, 1.15),
    });
  }
}

export function stepParticles(list, dt) {
  for (const p of list) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === "text" ? 10 : 30) * dt;
  }
  return list.filter((p) => p.life < p.max);
}

function Heart({ color = "#ff6b8b" }) {
  return (
    <svg viewBox="0 0 24 22" width="18" height="16">
      <path d="M12 21 C5 15 1 11.5 1 7 C1 3.5 3.8 1 7 1 C9.2 1 11 2.2 12 4 C13 2.2 14.8 1 17 1 C20.2 1 23 3.5 23 7 C23 11.5 19 15 12 21 Z" fill={color} stroke="#8a2840" strokeWidth="1.6" />
      <circle cx="7" cy="6" r="2" fill="#fff" opacity="0.6" />
    </svg>
  );
}

function Sparkle({ color = "#ffd257" }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill={color} stroke="#b57d0c" strokeWidth="1" />
    </svg>
  );
}

function Note() {
  return (
    <svg viewBox="0 0 16 20" width="13" height="16">
      <path d="M6 15 V3 L15 1 V12" fill="none" stroke="#3d6b8c" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="4" cy="15.5" rx="3.6" ry="2.8" fill="#3d6b8c" />
      <ellipse cx="13" cy="12.5" rx="3.6" ry="2.8" fill="#3d6b8c" />
    </svg>
  );
}

export function Particles({ list }) {
  return list.map((p) => {
    const t = p.life / p.max;
    const opacity = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
    const style = {
      position: "absolute",
      left: p.x,
      top: p.y,
      transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.scale * (0.7 + 0.3 * Math.min(1, t * 4))})`,
      opacity,
      pointerEvents: "none",
    };
    if (p.kind === "text")
      return (
        <div
          key={p.id}
          style={{ ...style, transform: "translate(-50%, -50%)", color: p.color || "var(--accent-strong)", textShadow: "0 1px 0 var(--surface), 0 0 6px var(--surface)" }}
          className="font-mono text-sm font-semibold whitespace-nowrap"
        >
          {p.text}
        </div>
      );
    return (
      <div key={p.id} style={style}>
        {p.kind === "heart" ? <Heart color={p.color} /> : p.kind === "note" ? <Note /> : <Sparkle color={p.color} />}
      </div>
    );
  });
}
