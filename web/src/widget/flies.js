// Moscas que entran por un costado, revolotean cerca del piso y se van si nadie se las come.
const LIFETIME_S = 70;
const SPEED = 85;
let nextId = 1;

const rand = (a, b) => a + Math.random() * (b - a);

export function createFly(world) {
  const fromLeft = Math.random() < 0.5;
  return {
    id: nextId++,
    x: fromLeft ? -20 : world.width + 20,
    y: world.height - rand(90, 260),
    heading: fromLeft ? rand(-0.4, 0.4) : Math.PI + rand(-0.4, 0.4),
    age: 0,
    dead: false,
    leaving: false,
    treat: false,
  };
}

/** Mosca dorada que aparece cerca del sapo cuando lo alimentás. */
export function createTreat(world, near) {
  const side = near.x > world.width / 2 ? -1 : 1;
  return {
    id: nextId++,
    x: Math.min(Math.max(near.x + side * rand(120, 170), 30), world.width - 30),
    y: world.height - rand(150, 190),
    heading: side > 0 ? Math.PI : 0,
    age: 4,
    dead: false,
    leaving: false,
    treat: true,
  };
}

/** Devuelve false cuando la mosca ya salió de la pantalla y hay que borrarla. */
export function stepFly(fly, dt, world) {
  fly.age += dt;
  if (fly.age > LIFETIME_S) fly.leaving = true;

  fly.heading += rand(-3, 3) * dt;
  if (!fly.leaving) {
    // La mantenemos en la franja baja de la pantalla, al alcance del sapo.
    const minY = world.height - 300;
    const maxY = world.height - 60;
    if ((fly.y < minY && Math.sin(fly.heading) < 0) || (fly.y > maxY && Math.sin(fly.heading) > 0)) {
      fly.heading = -fly.heading;
    }
    if (fly.age > 3) {
      if (fly.x < 40 && Math.cos(fly.heading) < 0) fly.heading = Math.PI - fly.heading;
      if (fly.x > world.width - 40 && Math.cos(fly.heading) > 0) fly.heading = Math.PI - fly.heading;
    }
  }

  const speed = fly.leaving ? SPEED * 1.6 : SPEED;
  fly.x += Math.cos(fly.heading) * speed * dt;
  fly.y += Math.sin(fly.heading) * speed * dt + Math.sin(fly.age * 14) * 0.6;

  const offscreen = fly.x < -60 || fly.x > world.width + 60 || fly.y < -60;
  return !(fly.leaving && offscreen);
}
