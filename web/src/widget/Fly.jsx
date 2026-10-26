export function FlySprite({ size = 22, treat = false }) {
  const body = treat ? "#e2a72e" : "#2b2f33";
  const head = treat ? "#c98a17" : "#22262a";
  return (
    <svg viewBox="0 0 22 18" width={size} height={(size * 18) / 22} style={{ overflow: "visible", display: "block" }}>
      {treat && <circle cx="11" cy="10" r="11" fill="#ffd66b" opacity="0.35" className="fly-glow" />}
      <ellipse className="fly-wing" cx="8" cy="5" rx="5" ry="4" fill="#dff1ff" stroke="#9cc3e0" strokeWidth="0.6" opacity="0.85" />
      <ellipse className="fly-wing" cx="13" cy="5" rx="5" ry="4" fill="#dff1ff" stroke="#9cc3e0" strokeWidth="0.6" opacity="0.85" />
      <ellipse cx="11" cy="11" rx="7" ry="5" fill={body} />
      <path d="M8 8 v6 M11 7 v8 M14 8 v6" stroke={treat ? "#f6d27a" : "#3e444a"} strokeWidth="1" />
      <circle cx="17" cy="10" r="3.4" fill={head} />
      <circle cx="18.4" cy="9" r="1.6" fill="#e0475b" />
    </svg>
  );
}

export function Fly({ fly, onSwat }) {
  const facingLeft = Math.cos(fly.heading) < 0;
  return (
    <div
      data-hit
      onPointerDown={(e) => {
        e.stopPropagation();
        onSwat(fly.id);
      }}
      style={{
        position: "absolute",
        left: fly.x - 11,
        top: fly.y - 9,
        padding: 6,
        margin: -6,
        cursor: "crosshair",
        transform: facingLeft ? "scaleX(-1)" : undefined,
      }}
    >
      <FlySprite treat={fly.treat} />
    </div>
  );
}
