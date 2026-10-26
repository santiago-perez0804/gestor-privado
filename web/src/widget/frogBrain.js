// Comportamiento del sapo: máquina de estados + física simple. No toca el DOM;
// `stepFrog` muta el objeto `frog` y devuelve eventos para que el widget reaccione.

export const FROG_W = 112;
export const FROG_H = 103;
const VIEWBOX_SCALE = FROG_W / 120;

const GRAVITY = 1800;
const WALK_SPEED = 55;
const SLEEP_AFTER_MS = 150_000;
const FLY_REACH = 240;
const MOUSE_REACH_MIN = 110;
const MOUSE_REACH_MAX = 380;

// Tiempos de la lengua: preparación (se agacha), disparo elástico y retracción.
export const TONGUE_AIM_S = 0.12;
export const TONGUE_OUT_S = 0.17;
export const TONGUE_IN_S = 0.26;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function easeOutBack(x) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}
const easeInCubic = (x) => x * x * x;

/** Estados en los que el sapo está "libre" y se lo puede interrumpir sin problema. */
const FREE_STATES = new Set(["idle", "walk", "lookAround", "croak", "yawn"]);
const TIMED_STATES = new Set(["croak", "chew", "dizzy", "wake", "yawn", "lookAround", "petting"]);

export function createFrog(world, now, x = world.width - 180) {
  return {
    x,
    y: world.height,
    vx: 0,
    vy: 0,
    facing: -1,
    onGround: true,
    state: "idle",
    t: 0,
    dur: 2,
    bouncy: false,
    celebrate: false,
    hardLanding: false,
    explore: false,
    exiting: false,
    resume: null,
    gotoX: null,
    afterGoto: null,
    dnd: false,
    module: null,
    targetFlyId: null,
    tongue: null,
    lastInteraction: now,
    nextMouseTongueAt: now + rand(60_000, 180_000),
  };
}

export function enter(frog, state, dur = 0) {
  frog.state = state;
  frog.t = 0;
  frog.dur = dur;
}

/** Punto de la boca en coordenadas de pantalla. */
export function mouthPoint(frog) {
  return {
    x: frog.x - FROG_W / 2 + 60 * VIEWBOX_SCALE,
    y: frog.y - FROG_H + 53 * VIEWBOX_SCALE,
  };
}

function startTongue(frog, kind, target, id = null) {
  frog.facing = target.x >= frog.x ? 1 : -1;
  frog.vx = 0;
  frog.tongue = { kind, id, tx: target.x, ty: target.y, p: 0, t: 0, phase: "aim", carrying: false, treat: false };
  enter(frog, "tongue");
}

function hopToward(frog, dx, power = 1) {
  frog.facing = dx >= 0 ? 1 : -1;
  frog.vx = clamp(dx * 1.4, -260, 260) || frog.facing * 140;
  frog.vy = -rand(380, 500) * power;
  frog.onGround = false;
  frog.bouncy = false;
  enter(frog, "air");
}

/** Salto de festejo en el lugar. */
export function celebrate(frog) {
  frog.vx = 0;
  frog.vy = -430;
  frog.onGround = false;
  frog.bouncy = false;
  frog.celebrate = true;
  enter(frog, "air");
}

/** Ir saltando hasta `x` y después entrar en `after` ({ state, dur }). */
export function goTo(frog, x, after) {
  frog.gotoX = x;
  frog.afterGoto = after;
  frog.tongue = null;
  enter(frog, "goto");
}

export function chaseFly(frog, flyId) {
  frog.targetFlyId = flyId;
  enter(frog, "chase", 15);
}

function chooseNext(frog, world) {
  const { now, flies, mouse, prefs, pet, quiet } = world;
  const hungry = pet.hunger < 40;

  const fly = !quiet && flies.find((f) => !f.dead && f.x > 0 && f.x < world.width);
  if (fly && Math.random() < (hungry ? 0.95 : 0.75)) {
    chaseFly(frog, fly.id);
    return;
  }

  const mouseFresh = mouse && now - mouse.t < 5000;
  if (!quiet && prefs.tongueEnabled && mouseFresh && now >= frog.nextMouseTongueAt) {
    const m = mouthPoint(frog);
    const d = Math.hypot(mouse.x - m.x, mouse.y - m.y);
    if (d > MOUSE_REACH_MIN && d < MOUSE_REACH_MAX) {
      frog.nextMouseTongueAt = now + rand(3 * 60_000, 8 * 60_000);
      startTongue(frog, "mouse", { x: mouse.x, y: mouse.y });
      return;
    }
  }

  if ((pet.energy < 20 && Math.random() < 0.5) || now - frog.lastInteraction > SLEEP_AFTER_MS) {
    enter(frog, "sleep", rand(40, 120));
    return;
  }

  const r = Math.random();
  const lazy = pet.energy < 40;
  if (lazy && r < 0.15) {
    enter(frog, "yawn", 1.8);
    return { type: "yawn" };
  }
  if (r < 0.34) {
    const nearLeft = frog.x < 200;
    const nearRight = frog.x > world.width - 200;
    frog.facing = nearLeft ? 1 : nearRight ? -1 : Math.random() < 0.5 ? -1 : 1;
    frog.explore = Math.random() < 0.4;
    enter(frog, "walk", rand(2, 5));
  } else if (r < (lazy ? 0.4 : 0.52)) {
    const dir = frog.x < 200 ? 1 : frog.x > world.width - 200 ? -1 : Math.random() < 0.5 ? -1 : 1;
    hopToward(frog, dir * rand(80, 160));
  } else if (r < 0.62) {
    enter(frog, "lookAround", 2.2);
  } else if (r < 0.68) {
    enter(frog, "croak", 1.2);
    return { type: "croak" };
  } else if (r < 0.74 && pet.mood > 70) {
    celebrate(frog);
    return { type: "happy" };
  } else {
    enter(frog, "idle", rand(2, 5));
  }
}

function afterLanding(frog) {
  if (frog.hardLanding) {
    frog.hardLanding = false;
    enter(frog, "dizzy", 1.8);
  } else if (frog.resume) {
    const next = frog.resume;
    frog.resume = null;
    enter(frog, next, next === "chase" ? 10 : 0);
  } else {
    enter(frog, frog.module ? "module" : "idle", rand(1, 3));
  }
}

export function stepFrog(frog, dt, world) {
  const events = [];
  const emit = (e) => e && events.push(e);
  const floor = world.height;
  const minX = FROG_W / 2;
  const maxX = world.width - FROG_W / 2;
  frog.t += dt;

  switch (frog.state) {
    case "idle":
      frog.vx = 0;
      if (frog.t > frog.dur) emit(chooseNext(frog, world));
      break;

    case "walk": {
      const tired = 0.6 + 0.4 * (world.pet.energy / 100);
      frog.vx = frog.facing * WALK_SPEED * tired;
      const atLeft = frog.x <= minX + 2 && frog.facing < 0 && !(world.openLeft && frog.explore);
      const atRight = frog.x >= maxX - 2 && frog.facing > 0 && !(world.openRight && frog.explore);
      if (atLeft || atRight) frog.facing *= -1;
      if (frog.t > frog.dur) enter(frog, "idle", rand(1.5, 4));
      break;
    }

    case "goto":
      frog.vx = 0;
      if (frog.onGround && frog.t > 0.25) {
        const dx = frog.gotoX - frog.x;
        if (Math.abs(dx) < 14) {
          const after = frog.afterGoto ?? { state: "idle", dur: 1 };
          frog.afterGoto = null;
          frog.gotoX = null;
          enter(frog, after.state, after.dur);
        } else {
          hopToward(frog, clamp(dx, -170, 170));
          frog.resume = "goto";
        }
      }
      break;

    case "chase": {
      const fly = world.flies.find((f) => f.id === frog.targetFlyId && !f.dead);
      if (!fly || frog.t > frog.dur) {
        frog.targetFlyId = null;
        enter(frog, "idle", rand(1, 2));
        break;
      }
      frog.vx = 0;
      frog.facing = fly.x >= frog.x ? 1 : -1;
      const m = mouthPoint(frog);
      if (Math.hypot(fly.x - m.x, fly.y - m.y) < FLY_REACH) {
        startTongue(frog, "fly", fly, fly.id);
        frog.tongue.treat = !!fly.treat;
      } else if (frog.onGround && frog.t > 0.35) {
        // Lejos: salta hacia la mosca. Cerca pero alta: salto vertical para acercar la boca.
        const dx = fly.x - frog.x;
        const far = Math.abs(dx) > 60;
        hopToward(frog, far ? dx : dx * 0.3, far ? 1 : 1.3);
        frog.resume = "chase";
      }
      break;
    }

    case "tongue": {
      const tg = frog.tongue;
      tg.t += dt;
      if (tg.phase === "aim") {
        if (tg.t >= TONGUE_AIM_S) {
          tg.phase = "out";
          tg.t = 0;
          emit({ type: "tongueOut" });
        }
      } else if (tg.phase === "out") {
        if (tg.kind === "fly") {
          const fly = world.flies.find((f) => f.id === tg.id && !f.dead);
          if (fly) {
            tg.tx = fly.x;
            tg.ty = fly.y;
          }
        }
        tg.p = easeOutBack(Math.min(1, tg.t / TONGUE_OUT_S));
        if (tg.t >= TONGUE_OUT_S) {
          tg.p = 1;
          tg.phase = "in";
          tg.t = 0;
          if (tg.kind === "fly") {
            tg.carrying = true;
            emit({ type: "flyCaught", id: tg.id, treat: tg.treat });
          } else {
            emit({ type: "yankStart", x: tg.tx, y: tg.ty });
          }
        }
      } else {
        tg.p = 1 - easeInCubic(Math.min(1, tg.t / TONGUE_IN_S));
        if (tg.kind === "mouse") {
          const m = mouthPoint(frog);
          emit({ type: "cursorTo", x: m.x + (tg.tx - m.x) * tg.p, y: m.y + (tg.ty - m.y) * tg.p });
        }
        if (tg.t >= TONGUE_IN_S) {
          const ate = tg.carrying;
          frog.tongue = null;
          if (ate) {
            enter(frog, "chew", 1.3);
            emit({ type: "gulp" });
          } else {
            enter(frog, "idle", rand(1, 2));
          }
        }
      }
      break;
    }

    case "land":
      if (frog.t > frog.dur) afterLanding(frog);
      break;

    case "sleep":
      if (!frog.dnd && frog.t > frog.dur) {
        frog.lastInteraction = world.now;
        enter(frog, "wake", 1);
      }
      break;

    default:
      if (TIMED_STATES.has(frog.state) && frog.t > frog.dur) enter(frog, "idle", rand(1.5, 3));
      // attentive, module, focus, rest y grabbed los maneja el widget.
      break;
  }

  // ---- física ----
  if (frog.state === "grabbed") return events;

  const allowLeft = world.openLeft && (frog.explore || !frog.onGround);
  const allowRight = world.openRight && (frog.explore || !frog.onGround);

  if (!frog.onGround) {
    frog.vy += GRAVITY * dt;
    frog.x += frog.vx * dt;
    frog.y += frog.vy * dt;

    if (frog.x < minX && !allowLeft) {
      frog.x = minX;
      frog.vx = Math.abs(frog.vx) * 0.5;
      if (frog.bouncy) emit({ type: "bounce" });
    } else if (frog.x > maxX && !allowRight) {
      frog.x = maxX;
      frog.vx = -Math.abs(frog.vx) * 0.5;
      if (frog.bouncy) emit({ type: "bounce" });
    }
    if (frog.y - FROG_H < 0) {
      frog.y = FROG_H;
      frog.vy = Math.abs(frog.vy) * 0.4;
    }
    if (frog.y >= floor) {
      frog.y = floor;
      if (frog.bouncy && frog.vy > 550) {
        if (frog.vy > 1400) frog.hardLanding = true;
        frog.vy = -frog.vy * 0.35;
        frog.vx *= 0.7;
        emit({ type: "bounce" });
      } else {
        frog.vy = 0;
        frog.vx = 0;
        frog.onGround = true;
        frog.bouncy = false;
        const wasCelebrating = frog.celebrate;
        frog.celebrate = false;
        if (frog.state === "air") enter(frog, "land", wasCelebrating ? 0.25 : 0.18);
        emit({ type: "land" });
      }
    }
  } else {
    frog.y = floor;
    frog.x += frog.vx * dt;
    if (!allowLeft) frog.x = Math.max(frog.x, minX);
    if (!allowRight) frog.x = Math.min(frog.x, maxX);
  }

  if (!frog.exiting && (frog.x < 0 || frog.x > world.width)) {
    frog.exiting = true;
    emit({ type: "exitEdge", side: frog.x < 0 ? "left" : "right" });
  }

  return events;
}

/** El usuario soltó al sapo después de arrastrarlo. */
export function throwFrog(frog, vx, vy) {
  frog.vx = clamp(vx, -2500, 2500);
  frog.vy = clamp(vy, -2500, 2500);
  frog.onGround = false;
  frog.bouncy = true;
  frog.celebrate = false;
  frog.facing = frog.vx >= 0 ? 1 : -1;
  enter(frog, "air");
}

export function isFree(frog) {
  return FREE_STATES.has(frog.state);
}

/** Pose corporal (animaciones CSS) a partir del estado. */
export function poseOf(frog) {
  switch (frog.state) {
    case "air":
      return frog.celebrate ? "happy" : frog.bouncy ? "tumble" : "air";
    case "chase":
    case "goto":
      return frog.onGround ? "idle" : "air";
    case "tongue":
      return frog.tongue?.phase === "aim" ? "aim" : "tongue";
    case "module":
      return frog.module ? `module-${frog.module}` : "idle";
    case "attentive":
      return "idle";
    default:
      return frog.state;
  }
}
