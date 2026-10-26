import { memo } from "react";
import { FROG_W, FROG_H } from "./frogBrain.js";

// Estilo "sticker": contorno uniforme, colores planos, una luz y una sombra suave.
// El contorno es una variable CSS para que cada especie tenga el suyo (verde el sapo, marrón el zorro).
const OUT = "var(--pet-out, #1f4d36)";
const PALETTES = {
  healthy: { skin: "#7fd48b", shade: "#5cba72", light: "#a8e8ae", out: "#1f4d36" },
  sick: { skin: "#b9cf7e", shade: "#9cb463", light: "#d3e3a3", out: "#1f4d36" },
};
const FOX_PALETTES = {
  healthy: { skin: "#f28b3c", shade: "#d9692a", light: "#ffb779", out: "#5a2a12" },
  sick: { skin: "#d7a46e", shade: "#bf8a55", light: "#ebc59a", out: "#5a2a12" },
};
const FOX_WHITE = "#fff6ea";
const FOX_PAW = "#5b3424";
const BELLY = "#f4f9e4";
const CHEEK = "#ff9db0";
const EYE = "#1c2a23";
const MOUTH = "#8a2840";
const LEAF = "#a7e27f";
const LEAF_DARK = "#4f9a46";

const BODY_D =
  "M24 101 C10 101 6 86 10 74 C13 64 18 56 23 50 C15 38 22 16 40 15 C50 14.5 56 21 57 27 Q60 29 63 27 C64 21 70 14.5 80 15 C98 16 105 38 97 50 C102 56 107 64 110 74 C114 86 110 101 96 101 Z";

const EYES = [40, 80];
const EYE_Y = 32;

// ---------------- cara ----------------

function OpenEye({ cx, look, big }) {
  const x = cx + look.x * 2.6;
  const y = EYE_Y + look.y * 2.2;
  return (
    <g className="frog-eye">
      {big && <circle cx={cx} cy={EYE_Y} r="8.5" fill="#fff" stroke={OUT} strokeWidth="1.6" />}
      <ellipse cx={x} cy={y} rx={big ? 4.2 : 6} ry={big ? 4.6 : 7} fill={EYE} />
      <circle cx={x + 2} cy={y - 2.6} r={big ? 1.4 : 2.1} fill="#fff" />
      {!big && <circle cx={x - 2} cy={y + 2.6} r="1" fill="#fff" opacity="0.8" />}
    </g>
  );
}

function Eyes({ expression, look, skin }) {
  const line = { fill: "none", stroke: OUT, strokeWidth: 2.6, strokeLinecap: "round" };
  return EYES.map((cx) => {
    switch (expression) {
      case "dead":
        return <path key={cx} d={`M${cx - 5} ${EYE_Y - 5} L${cx + 5} ${EYE_Y + 5} M${cx + 5} ${EYE_Y - 5} L${cx - 5} ${EYE_Y + 5}`} {...line} />;
      case "happy":
      case "chew":
        return <path key={cx} d={`M${cx - 6} ${EYE_Y + 2} Q${cx} ${EYE_Y - 6} ${cx + 6} ${EYE_Y + 2}`} {...line} />;
      case "asleep":
        return <path key={cx} d={`M${cx - 6} ${EYE_Y} Q${cx} ${EYE_Y + 5} ${cx + 6} ${EYE_Y}`} {...line} />;
      case "yawn":
        return (
          <path
            key={cx}
            d={cx < 60 ? `M${cx - 6} ${EYE_Y - 3} L${cx + 4} ${EYE_Y} L${cx - 6} ${EYE_Y + 3}` : `M${cx + 6} ${EYE_Y - 3} L${cx - 4} ${EYE_Y} L${cx + 6} ${EYE_Y + 3}`}
            {...line}
            strokeLinejoin="round"
          />
        );
      case "dizzy":
        return (
          <path
            key={cx}
            className="frog-spiral"
            d={`M${cx} ${EYE_Y} m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -5 0 a5 5 0 1 1 9 0 a6.5 6.5 0 1 1 -12 0`}
            {...line}
            strokeWidth="1.8"
          />
        );
      case "sleepy":
      case "focus":
        return (
          <g key={cx}>
            <OpenEye cx={cx} look={{ x: look.x * 0.5, y: expression === "focus" ? 1 : 0.6 }} />
            <path d={`M${cx - 8} ${EYE_Y + 0.5} A8 8 0 0 1 ${cx + 8} ${EYE_Y + 0.5} Z`} fill={skin} />
            <path d={`M${cx - 7.5} ${EYE_Y + 0.5} L${cx + 7.5} ${EYE_Y + 0.5}`} {...line} strokeWidth="2" />
          </g>
        );
      case "surprised":
        return <OpenEye key={cx} cx={cx} look={look} big />;
      default:
        return (
          <g key={cx} className="frog-blink">
            <OpenEye cx={cx} look={look} />
          </g>
        );
    }
  });
}

function Brows({ expression }) {
  const s = { fill: "none", stroke: OUT, strokeWidth: 2, strokeLinecap: "round" };
  if (expression === "sad" || expression === "sick")
    return (
      <g>
        <path d="M33 21 L45 18" {...s} />
        <path d="M87 21 L75 18" {...s} />
      </g>
    );
  if (expression === "focus")
    return (
      <g>
        <path d="M33 20 Q39.5 18.5 46 20.5" {...s} />
        <path d="M87 20 Q80.5 18.5 74 20.5" {...s} />
      </g>
    );
  return null;
}

function Mouth({ expression }) {
  const s = { fill: "none", stroke: OUT, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (expression) {
    case "joy":
    case "happy":
      return (
        <g>
          <path d="M51 48 Q60 60 69 48 Z" fill={MOUTH} stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
          <path d="M55 53.5 Q60 50.5 65 53.5 Q60 57.5 55 53.5 Z" fill="#ff8aa0" />
        </g>
      );
    case "tongue":
      return <ellipse cx="60" cy="53" rx="7.5" ry="6" fill={MOUTH} stroke={OUT} strokeWidth="2" />;
    case "surprised":
      return <ellipse cx="60" cy="52" rx="3.6" ry="4.4" fill={MOUTH} stroke={OUT} strokeWidth="1.8" />;
    case "yawn":
      return <ellipse className="frog-yawn-mouth" cx="60" cy="53" rx="6" ry="7.5" fill={MOUTH} stroke={OUT} strokeWidth="2" />;
    case "sad":
      return <path d="M54 52 Q60 47 66 52" {...s} />;
    case "sick":
    case "dizzy":
      return <path d="M52 51 q4 -3 8 0 q4 3 8 0" {...s} />;
    case "chew":
      return <path className="frog-chew" d="M53 50 q3.5 3.5 7 0 q3.5 3.5 7 0" {...s} />;
    case "asleep":
      return <ellipse cx="60" cy="51" rx="2.4" ry="1.8" fill={MOUTH} opacity="0.85" />;
    case "focus":
    case "dead":
      return <path d="M56 50.5 L64 50.5" {...s} />;
    default:
      return <path d="M54 49 Q57 52.5 60 49.5 Q63 52.5 66 49" {...s} />;
  }
}

// ---------------- accesorios ----------------

function Sprout() {
  return (
    <g className="frog-sprout">
      <path d="M60 28 Q59 21 62 16" fill="none" stroke={LEAF_DARK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M62 16 C63 8 73 5 78 8 C76 14 69 18 62 16 Z" fill={LEAF} stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M63.5 15 Q70 11 76 8.8" fill="none" stroke={LEAF_DARK} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function Nightcap() {
  return (
    <g>
      <path d="M22 27 C22 10 46 5 58 22 Z" fill="#7b8cff" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 12 C20 4 8 6 6 18" fill="none" stroke={OUT} strokeWidth="9" strokeLinecap="round" />
      <path d="M30 12 C20 4 8 6 6 18" fill="none" stroke="#7b8cff" strokeWidth="5.4" strokeLinecap="round" />
      <path d="M21 26 Q40 17 59 22" fill="none" stroke={OUT} strokeWidth="7" strokeLinecap="round" />
      <path d="M21 26 Q40 17 59 22" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="6" cy="20" r="5" fill="#fff" stroke={OUT} strokeWidth="1.8" />
      <circle cx="40" cy="14" r="1.4" fill="#fff" opacity="0.8" />
      <circle cx="49" cy="18" r="1.1" fill="#fff" opacity="0.8" />
    </g>
  );
}

function Headphones() {
  return (
    <g>
      <path d="M17 38 C14 -2 106 -2 103 38" fill="none" stroke={OUT} strokeWidth="7" strokeLinecap="round" />
      <path d="M17 38 C14 -2 106 -2 103 38" fill="none" stroke="#4b5568" strokeWidth="4" strokeLinecap="round" />
      <rect x="9" y="30" width="13" height="21" rx="6" fill="#ff6f6f" stroke={OUT} strokeWidth="2" />
      <rect x="98" y="30" width="13" height="21" rx="6" fill="#ff6f6f" stroke={OUT} strokeWidth="2" />
      <rect x="12" y="34" width="3" height="10" rx="1.5" fill="#fff" opacity="0.5" />
    </g>
  );
}

function Book() {
  return (
    <g className="frog-book">
      <path d="M33 85 L60 88 L87 85 L87 106 L60 108 L33 106 Z" fill="#e2735f" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
      <path d="M36 84 Q48 81 60 86 L60 105 Q48 100 36 103 Z" fill="#fffdf6" stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M84 84 Q72 81 60 86 L60 105 Q72 100 84 103 Z" fill="#fffdf6" stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M40 89 L55 90 M40 93 L55 94 M40 97 L52 97.6 M65 90 L80 89 M65 94 L80 93 M65 97.6 L77 97" stroke="#c9c2b0" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="37" cy="100" rx="6" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
      <ellipse cx="83" cy="100" rx="6" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
    </g>
  );
}

function Mug() {
  return (
    <g className="frog-mug">
      <g className="frog-steam" fill="none" stroke="#b8c4cc" strokeWidth="1.8" strokeLinecap="round">
        <path d="M86 70 q-3 -4 0 -8 q3 -4 0 -8" />
        <path d="M93 70 q-3 -4 0 -8 q3 -4 0 -8" />
      </g>
      <path d="M100 82 q9 0 9 7 q0 7 -9 7" fill="none" stroke={OUT} strokeWidth="5" />
      <path d="M100 82 q9 0 9 7 q0 7 -9 7" fill="none" stroke="#7aa7e0" strokeWidth="2.4" />
      <rect x="80" y="74" width="22" height="26" rx="5" fill="#7aa7e0" stroke={OUT} strokeWidth="2" />
      <rect x="83" y="77" width="4" height="15" rx="2" fill="#fff" opacity="0.45" />
      <ellipse cx="84" cy="96" rx="6" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
    </g>
  );
}

function Arm({ d }) {
  return (
    <g>
      <path d={d} fill="none" stroke={OUT} strokeWidth="9.5" strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--frog-skin)" strokeWidth="5.6" strokeLinecap="round" />
    </g>
  );
}

function Dumbbell() {
  return (
    <g className="prop-lift">
      <Arm d="M18 66 Q6 40 24 10" />
      <Arm d="M102 66 Q114 40 96 10" />
      <rect x="12" y="6.5" width="96" height="5" rx="2.5" fill="#9aa3b2" stroke={OUT} strokeWidth="1.5" />
      <rect x="2" y="-6" width="11" height="29" rx="3.5" fill="#4a5262" stroke={OUT} strokeWidth="1.8" />
      <rect x="107" y="-6" width="11" height="29" rx="3.5" fill="#4a5262" stroke={OUT} strokeWidth="1.8" />
      <rect x="4.5" y="-3" width="2.5" height="12" rx="1.2" fill="#fff" opacity="0.35" />
      <circle cx="24" cy="9" r="6" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
      <circle cx="96" cy="9" r="6" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
    </g>
  );
}

function Coins() {
  return (
    <g>
      <g className="prop-coin">
        <circle cx="60" cy="0" r="9" fill="#ffd257" stroke={OUT} strokeWidth="1.8" />
        <circle cx="60" cy="0" r="6" fill="none" stroke="#e0a92c" strokeWidth="1.2" />
        <text x="60" y="3.6" textAnchor="middle" fontSize="10" fontWeight="800" fill="#b57d0c" fontFamily="IBM Plex Sans, sans-serif">
          $
        </text>
      </g>
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx="108" cy={100 - i * 4.6} rx="10" ry="4" fill="#ffd257" stroke={OUT} strokeWidth="1.5" />
      ))}
      <ellipse cx="52" cy="99" rx="7" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
      <ellipse cx="68" cy="99" rx="7" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
    </g>
  );
}

function Popcorn() {
  return (
    <g>
      <g className="prop-kernel">
        <circle cx="76" cy="76" r="4" fill="#fff4cf" stroke={OUT} strokeWidth="1.2" />
      </g>
      <path d="M64 80 L92 80 L88 106 L68 106 Z" fill="#fff" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${67 + i * 8.5} 80 L${71 + i * 8.5} 80 L${70.5 + i * 7} 106 L${68.5 + i * 7} 106 Z`} fill="#ef4d5b" />
      ))}
      {[67, 73, 79, 85, 70, 82, 76].map((x, i) => (
        <circle key={i} cx={x} cy={i < 4 ? 78 : i < 6 ? 74 : 71} r="4.4" fill="#fff4cf" stroke={OUT} strokeWidth="1.2" />
      ))}
      <ellipse cx="64" cy="94" rx="6.5" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
      {/* Anteojos 3D */}
      <g>
        <rect x="29" y="25" width="22" height="14" rx="5" fill="#ff5d6c" opacity="0.75" stroke={OUT} strokeWidth="2" />
        <rect x="69" y="25" width="22" height="14" rx="5" fill="#4fc3f7" opacity="0.75" stroke={OUT} strokeWidth="2" />
        <path d="M51 31 Q60 27 69 31" fill="none" stroke={OUT} strokeWidth="2" />
      </g>
    </g>
  );
}

function Laptop() {
  return (
    <g>
      <ellipse className="prop-glow" cx="60" cy="52" rx="34" ry="22" fill="#9fd3ff" />
      <path d="M30 74 L90 74 L86 100 L34 100 Z" fill="#aab4be" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
      <path d="M55 82 C56 78 63 78 64 82 C64 86 60 89 59.5 89 C59 89 55 86 55 82 Z" fill={LEAF} stroke={OUT} strokeWidth="1.2" />
      <rect x="22" y="100" width="76" height="6" rx="3" fill="#8c96a1" stroke={OUT} strokeWidth="1.8" />
      <ellipse className="prop-type-l" cx="30" cy="99" rx="7" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
      <ellipse className="prop-type-r" cx="90" cy="99" rx="7" ry="4.5" fill="var(--frog-skin)" stroke={OUT} strokeWidth="1.8" />
      <text className="prop-float" x="98" y="30" fontSize="10" fontWeight="700" fill="#3b82f6" fontFamily="IBM Plex Mono, monospace">
        {"</>"}
      </text>
    </g>
  );
}

function Sac() {
  return <ellipse className="frog-sac" cx="60" cy="61" rx="12" ry="8.5" fill="#fbe3ea" stroke={OUT} strokeWidth="1.8" />;
}

// ---------------- zorro ----------------
// Misma caja (120×110), misma cara y mismas clases de animación que el sapo: solo cambia el cuerpo.

const FOX_BODY_D =
  "M26 101 C12 101 9 85 13 73 C16 63 21 56 25 52 C17 44 15 31 19 21 L23 3 L42 15 C50 12 70 12 78 15 L97 3 L101 21 C105 31 103 44 95 52 C99 56 104 63 107 73 C111 85 108 101 94 101 Z";

function FoxTail({ pal }) {
  return (
    <g className="fox-tail">
      <path d="M96 92 C122 92 128 66 116 50 C128 70 112 84 100 80 Z" fill={pal.skin} stroke={OUT} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M116 50 C121 58 120 66 115 72 C112 64 112 57 116 50 Z" fill={FOX_WHITE} stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  );
}

function FoxBody({ pal }) {
  return (
    <>
      <g className="frog-leg frog-leg-l">
        <ellipse cx="21" cy="96" rx="13" ry="8.5" fill={pal.shade} stroke={OUT} strokeWidth="2.2" />
      </g>
      <g className="frog-leg frog-leg-r">
        <ellipse cx="99" cy="96" rx="13" ry="8.5" fill={pal.shade} stroke={OUT} strokeWidth="2.2" />
      </g>
      <g className="frog-body">
        <path d={FOX_BODY_D} fill={pal.skin} />
        <g clipPath="url(#foxBodyClip)">
          <ellipse cx="60" cy="114" rx="62" ry="20" fill={pal.shade} />
          <ellipse cx="60" cy="83" rx="22" ry="17" fill={FOX_WHITE} />
          {/* máscara blanca del hocico */}
          <path d="M18 38 Q38 33 60 45 Q82 33 102 38 Q100 62 60 66 Q20 62 18 38 Z" fill={FOX_WHITE} />
          <ellipse cx="24" cy="70" rx="3" ry="8" fill={pal.light} transform="rotate(18 24 70)" />
        </g>
        <path d={FOX_BODY_D} fill="none" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
        {/* orejas por dentro */}
        <path d="M25 9 L37 16 L27 23 Z" fill="#6b3a22" opacity="0.85" />
        <path d="M95 9 L83 16 L93 23 Z" fill="#6b3a22" opacity="0.85" />
        <ellipse cx="34" cy="24" rx="4" ry="2.2" fill="#fff" opacity="0.5" transform="rotate(-30 34 24)" />
      </g>
    </>
  );
}

function FoxNose() {
  return <path d="M56.5 43 Q60 41 63.5 43 Q62 47 60 47.5 Q58 47 56.5 43 Z" fill="#2a1a12" stroke={OUT} strokeWidth="1" />;
}

// ---------------- mascota (sapo o zorro) ----------------

function FrogImpl({ pose, expression, look, sick, accessory, module, species = "sapo", ghost = false }) {
  const fox = species === "zorro";
  const pal = (fox ? FOX_PALETTES : PALETTES)[sick ? "sick" : "healthy"];
  const handsBusy = !!module || accessory === "focus" || accessory === "rest";
  const expr = ghost ? "dead" : expression;

  return (
    <svg
      viewBox="0 0 120 110"
      width={FROG_W}
      height={FROG_H}
      className={`frog-svg pose-${ghost ? "idle" : pose} expr-${expr} species-${species}${ghost ? " pet-ghost" : ""}`}
      style={{ overflow: "visible", display: "block", "--frog-skin": pal.skin, "--pet-out": pal.out }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="frogBodyClip">
          <path d={BODY_D} />
        </clipPath>
        <clipPath id="foxBodyClip">
          <path d={FOX_BODY_D} />
        </clipPath>
      </defs>

      {ghost && <ellipse className="pet-halo" cx="60" cy={fox ? -4 : 4} rx="20" ry="5" fill="none" stroke="#ffd257" strokeWidth="3" />}

      <g className="frog-root">
        {module === "fisico" && <Dumbbell />}
        {fox && <FoxTail pal={pal} />}

        {fox ? (
          <FoxBody pal={pal} />
        ) : (
          <>
        {/* patas traseras */}
        <g className="frog-leg frog-leg-l">
          <ellipse cx="19" cy="95" rx="15" ry="9.5" fill={pal.shade} stroke={OUT} strokeWidth="2.2" />
          <path d="M8 100 q-3 3 -6 3 M13 102 q-1 3 -3 4" stroke={OUT} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
        <g className="frog-leg frog-leg-r">
          <ellipse cx="101" cy="95" rx="15" ry="9.5" fill={pal.shade} stroke={OUT} strokeWidth="2.2" />
          <path d="M112 100 q3 3 6 3 M107 102 q1 3 3 4" stroke={OUT} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>

        <g className="frog-body">
          <path d={BODY_D} fill={pal.skin} />
          <g clipPath="url(#frogBodyClip)">
            <ellipse cx="60" cy="114" rx="62" ry="22" fill={pal.shade} />
            <ellipse cx="60" cy="81" rx="27" ry="17" fill={BELLY} />
            <ellipse cx="60" cy="86" rx="20" ry="9" fill="#e9f3d2" />
            <ellipse cx="22" cy="68" rx="3" ry="8" fill={pal.light} transform="rotate(18 22 68)" />
          </g>
          <path d={BODY_D} fill="none" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" />
          <ellipse cx="32" cy="22" rx="4.4" ry="2.4" fill="#fff" opacity="0.55" transform="rotate(-32 32 22)" />
          <ellipse cx="73" cy="20" rx="2.6" ry="1.5" fill="#fff" opacity="0.45" transform="rotate(-25 73 20)" />
        </g>
          </>
        )}

        {!fox && accessory !== "nightcap" && !ghost && <Sprout />}

        {/* cara */}
        <g className="frog-face">
          {pose === "croak" && !fox && !ghost && <Sac />}
          <ellipse className="frog-cheek" cx="27" cy="46" rx={expr === "chew" ? 8 : 6.2} ry={expr === "chew" ? 5 : 3.6} fill={CHEEK} opacity={fox ? 0.5 : 0.7} />
          <ellipse className="frog-cheek" cx="93" cy="46" rx={expr === "chew" ? 8 : 6.2} ry={expr === "chew" ? 5 : 3.6} fill={CHEEK} opacity={fox ? 0.5 : 0.7} />
          <Eyes expression={expr} look={look} skin={fox ? FOX_WHITE : pal.skin} />
          <Brows expression={expr} />
          {fox && <FoxNose />}
          <Mouth expression={expr} />
          {sick && !ghost && <path className="frog-sweat" d="M101 26 q4 7 0 9 q-4 -2 0 -9z" fill="#8fd0f5" stroke={OUT} strokeWidth="1" />}
        </g>

        {/* patitas delanteras */}
        {!handsBusy && (
          <g className="frog-feet">
            <ellipse cx="45" cy="102" rx="9" ry="5" fill={fox ? FOX_PAW : pal.skin} stroke={OUT} strokeWidth="2" />
            <ellipse cx="75" cy="102" rx="9" ry="5" fill={fox ? FOX_PAW : pal.skin} stroke={OUT} strokeWidth="2" />
            <path d="M42 102.5 v2.5 M48 102.5 v2.5 M72 102.5 v2.5 M78 102.5 v2.5" stroke={OUT} strokeWidth="1.4" strokeLinecap="round" />
          </g>
        )}

        {accessory === "nightcap" && <Nightcap />}
        {accessory === "focus" && (
          <>
            <Headphones />
            <Book />
          </>
        )}
        {accessory === "rest" && <Mug />}
        {module === "fisico" && <path className="frog-sweat" d="M100 26 q4 7 0 9 q-4 -2 0 -9z" fill="#8fd0f5" stroke={OUT} strokeWidth="1" />}
        {module === "gastos" && <Coins />}
        {module === "ocio" && <Popcorn />}
        {module === "proyectos" && <Laptop />}
      </g>
    </svg>
  );
}

export const Frog = memo(
  FrogImpl,
  (a, b) =>
    a.pose === b.pose &&
    a.expression === b.expression &&
    a.sick === b.sick &&
    a.accessory === b.accessory &&
    a.module === b.module &&
    a.species === b.species &&
    a.ghost === b.ghost &&
    a.look.x === b.look.x &&
    a.look.y === b.look.y
);

/** Carita chica para la tarjeta de estado. */
export function FrogAvatar({ size = 40, sick = false, species = "sapo", ghost = false }) {
  if (species === "zorro") return <FoxAvatar size={size} sick={sick} ghost={ghost} />;
  const pal = sick ? PALETTES.sick : PALETTES.healthy;
  return (
    <svg viewBox="4 6 112 70" width={size} height={(size * 70) / 112} aria-hidden="true" style={{ opacity: ghost ? 0.5 : 1, "--pet-out": pal.out }}>
      <path d={BODY_D} fill={pal.skin} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <Sprout />
      {EYES.map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={EYE_Y} rx="6" ry="7" fill={EYE} />
          <circle cx={cx + 2} cy={EYE_Y - 2.6} r="2.1" fill="#fff" />
        </g>
      ))}
      <ellipse cx="27" cy="46" rx="6.2" ry="3.6" fill={CHEEK} opacity="0.7" />
      <ellipse cx="93" cy="46" rx="6.2" ry="3.6" fill={CHEEK} opacity="0.7" />
      <path d="M54 49 Q57 52.5 60 49.5 Q63 52.5 66 49" fill="none" stroke={OUT} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function FoxAvatar({ size, sick, ghost }) {
  const pal = FOX_PALETTES[sick ? "sick" : "healthy"];
  return (
    <svg viewBox="4 0 112 76" width={size} height={(size * 76) / 112} aria-hidden="true" style={{ opacity: ghost ? 0.5 : 1, "--pet-out": pal.out }}>
      <defs>
        <clipPath id="foxAvatarClip">
          <path d={FOX_BODY_D} />
        </clipPath>
      </defs>
      <path d={FOX_BODY_D} fill={pal.skin} />
      <path d="M18 38 Q38 33 60 45 Q82 33 102 38 Q100 62 60 66 Q20 62 18 38 Z" fill={FOX_WHITE} clipPath="url(#foxAvatarClip)" />
      <path d={FOX_BODY_D} fill="none" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M25 9 L37 16 L27 23 Z" fill="#6b3a22" opacity="0.85" />
      <path d="M95 9 L83 16 L93 23 Z" fill="#6b3a22" opacity="0.85" />
      {EYES.map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={EYE_Y} rx="6" ry="7" fill={EYE} />
          <circle cx={cx + 2} cy={EYE_Y - 2.6} r="2.1" fill="#fff" />
        </g>
      ))}
      <FoxNose />
      <path d="M54 50 Q57 53.5 60 50.5 Q63 53.5 66 50" fill="none" stroke={OUT} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
