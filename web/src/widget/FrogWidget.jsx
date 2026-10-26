import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../components/common/ErrorBoundary.jsx";
import { AnimatePresence, motion } from "framer-motion";
import { Frog } from "./Frog.jsx";
import { Fly } from "./Fly.jsx";
import { Tongue } from "./Tongue.jsx";
import { SpeechBubble } from "./SpeechBubble.jsx";
import { PomodoroBadge } from "./PomodoroBadge.jsx";
import { PetCard, CARD_W } from "./card/PetCard.jsx";
import { Particles, spawn, stepParticles } from "./particles.jsx";
import { PANELS } from "./panels/index.js";
import {
  FROG_W,
  FROG_H,
  createFrog,
  enter,
  stepFrog,
  throwFrog,
  mouthPoint,
  poseOf,
  isFree,
  celebrate,
  goTo,
  chaseFly,
} from "./frogBrain.js";
import { createFly, createTreat, stepFly } from "./flies.js";
import {
  loadPet,
  savePet,
  tickPet,
  boost,
  earnXp,
  markCare,
  daysWithoutCare,
  shouldDie,
  hoursToDeath,
  killPet,
  adoptInto,
  toggleAccessory,
  SPECIES,
} from "./pet.js";
import * as pomodoro from "./pomodoro.js";
import { useReminders } from "./useReminders.js";
import * as bridge from "./bridge.js";
import * as sound from "./sound.js";

const PANEL_W = 300;
const CARD_IDLE_CLOSE_MS = 20_000;
const PANEL_IDLE_CLOSE_MS = 60_000;
const MAX_CURSOR_PULL = 150;

// Además de estas, a veces dice su sonido (SPECIES[especie].soft).
const CHATTER = [
  "¿Tomaste agua hoy?",
  "Hacé click en mí y te muestro cómo venís.",
  "Probá Ctrl+Alt+S para anotar un gasto al toque.",
  "Si me acariciás moviendo el mouse encima, me pongo contento.",
  "¿Y si hoy hacemos piernas?",
  "Un pomodoro y después un mate, ¿dale?",
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Al montar, la ventana oculta puede reportar tamaño 0: en ese caso usamos el área del monitor.
const currentWorld = (bounds) => ({
  width: window.innerWidth > 100 ? window.innerWidth : bounds.width,
  height: window.innerHeight > 100 ? window.innerHeight : bounds.height,
});

function notify(title, body) {
  try {
    new Notification(title, { body, silent: true });
  } catch {
    /* sin notificaciones nativas: queda el globito */
  }
}

/** Expresión de la cara según lo que está haciendo y cómo se siente. */
function expressionOf(frog, pet, pose) {
  switch (frog.state) {
    case "sleep":
      return "asleep";
    case "dizzy":
      return "dizzy";
    case "grabbed":
    case "wake":
      return "surprised";
    case "tongue":
      return frog.tongue?.phase === "aim" ? "neutral" : "tongue";
    case "chew":
      return "chew";
    case "petting":
    case "rest":
      return "happy";
    case "yawn":
      return "yawn";
    case "focus":
      return "focus";
    case "module":
      return frog.module === "ocio" ? "chew" : "neutral";
    default:
      break;
  }
  if (pose === "tumble") return "surprised";
  if (pose === "happy") return "joy";
  const s = pet.stats;
  if (s.health < 30) return "sick";
  if (s.energy < 25) return "sleepy";
  if (s.hunger < 25 || s.mood < 30) return "sad";
  if (s.mood >= 85) return "joy";
  return "neutral";
}

function frogFromArrival(arrival, env, world, now) {
  const frog = createFrog(world, now);
  if (!arrival) {
    frog.x = world.width / 2;
    return frog;
  }
  const { gx, gy, frog: f } = arrival;
  frog.x = clamp(gx - env.bounds.x, FROG_W / 2 + 2, world.width - FROG_W / 2 - 2);
  frog.facing = f.facing;
  if (f.onGround) {
    enter(frog, "walk", rand(1.5, 3));
  } else {
    frog.y = clamp(gy - env.bounds.y, FROG_H, world.height);
    frog.onGround = false;
    frog.vx = f.vx;
    frog.vy = f.vy;
    frog.bouncy = f.bouncy;
    enter(frog, "air");
  }
  return frog;
}

// =====================================================================
// Escenario del sapo: corre solo en la ventana (monitor) donde está el sapo.
// =====================================================================

function FrogStage({ env, arrival }) {
  const worldRef = useRef(null);
  worldRef.current ??= currentWorld(env.bounds);
  const petRef = useRef(null);
  petRef.current ??= loadPet();
  const pomoRef = useRef(null);
  pomoRef.current ??= pomodoro.loadPomodoro();
  const frogRef = useRef(null);
  if (!frogRef.current) {
    frogRef.current = frogFromArrival(arrival, env, worldRef.current, Date.now());
    if (petRef.current.dnd) {
      frogRef.current.dnd = true;
      enter(frogRef.current, "sleep", 1e9);
    }
  }
  const fliesRef = useRef([]);
  const particlesRef = useRef([]);
  const mouseRef = useRef(null);
  const prefsRef = useRef({ tongueEnabled: true, ...env.prefs });
  const dragRef = useRef(null);
  const petTrackRef = useRef({ dir: 0, flips: [], last: 0 });
  const clicksRef = useRef([]);
  const yankRef = useRef(null);
  const lastHitHoverRef = useRef(Date.now());
  const timersRef = useRef({
    nextFlyAt: Date.now() + 25_000,
    nextChatterAt: Date.now() + rand(4, 8) * 60_000,
    petAcc: 0,
    saveAcc: 0,
    zAcc: 0,
    lastCriticalWarn: 0,
  });
  const bubbleQueueRef = useRef([]);
  const transferringRef = useRef(false);
  const timeRef = useRef(0);

  const [, setFrame] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardView, setCardView] = useState("home");
  const [module, setModule] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [muted, setMutedState] = useState(sound.isMuted);
  const [petView, setPetView] = useState(() => structuredClone(petRef.current));
  const [pomoView, setPomoView] = useState(() => structuredClone(pomoRef.current));

  const uiRef = useRef({});
  uiRef.current = { cardOpen, module, bubble };

  // ---------- helpers de estado ----------
  const refreshPet = useCallback(() => setPetView(structuredClone(petRef.current)), []);
  const refreshPomo = useCallback(() => setPomoView(structuredClone(pomoRef.current)), []);
  const persist = useCallback(() => {
    savePet(petRef.current);
    pomodoro.savePomodoro(pomoRef.current);
  }, []);

  const say = useCallback((text, ms = 4000, actions) => {
    setBubble({ id: Math.random(), text, until: Date.now() + ms, actions });
  }, []);

  const headPoint = () => ({ x: frogRef.current.x, y: frogRef.current.y - FROG_H + 12 });

  /** Suma XP de una fuente (con tope diario). Devuelve lo ganado para mostrarlo. */
  const gainXp = useCallback(
    (source, units = 1) => {
      const pet = petRef.current;
      const r = earnXp(pet, source, units);
      if (r.streakBonus) {
        bubbleQueueRef.current.push({
          text:
            pet.streak.count > 1
              ? `¡${pet.streak.count} días seguidos juntos! +${r.streakBonus} XP de racha.`
              : `¡Hola! +${r.streakBonus} XP por pasar a saludar hoy.`,
        });
      }
      if (r.leveled) {
        const h = headPoint();
        spawn(particlesRef.current, "sparkle", h.x, h.y, { count: 8 });
        sound.pop();
        say(`¡${pet.name} subió a nivel ${pet.level}!`, 4500);
        for (const a of r.unlocked) bubbleQueueRef.current.push({ text: `¡Desbloqueaste un accesorio: ${a.name}! Equipalo desde mi tarjeta.` });
      }
      return r.gained;
    },
    [say]
  );

  // ---------- muerte ----------
  const handleDeath = useCallback(() => {
    const pet = petRef.current;
    killPet(pet);
    fliesRef.current = [];
    persist();
    refreshPet();
    setCardOpen(false);
    setModule(null);
    sound.chime();
    say(`${pet.name} se murió por falta de cuidados… Tus datos del gestor siguen intactos.`, 60_000, [
      { label: "Adoptar otra mascota", run: () => openCardRef.current("adopt") },
    ]);
  }, [persist, refreshPet, say]);
  const openCardRef = useRef(null);

  // ---------- tarjeta y paneles ----------
  const closeAll = useCallback(() => {
    const frog = frogRef.current;
    setCardOpen(false);
    setModule(null);
    frog.module = null;
    if (frog.state === "attentive" || frog.state === "module") enter(frog, "idle", rand(1, 2));
    bridge.releaseFocus();
  }, []);

  const openCard = useCallback((view = "home") => {
    const frog = frogRef.current;
    setBubble(null);
    setModule(null);
    frog.module = null;
    frog.tongue = null;
    frog.resume = null;
    setCardView(view);
    setCardOpen(true);
    lastHitHoverRef.current = Date.now();
    frog.lastInteraction = Date.now();
    if (isFree(frog) || frog.state === "module" || frog.state === "tongue") enter(frog, "attentive");
  }, []);

  openCardRef.current = openCard;

  // Al aparecer: adopción la primera vez, aviso si murió o si hace días que nadie la cuida.
  useEffect(() => {
    const t = setTimeout(() => {
      const pet = petRef.current;
      if (!pet.adopted) openCard("adopt");
      else if (!pet.alive) say(`${pet.name} ya no está… ¿Adoptamos otra mascota?`, 60_000, [{ label: "Adoptar", run: () => openCard("adopt") }]);
      else if (daysWithoutCare(pet) >= 2) {
        bubbleQueueRef.current.push({
          text: `¡Te extrañé! Hace ${Math.floor(daysWithoutCare(pet))} días que nadie me cuida.`,
          actions: [{ label: "Mimos", run: () => ctlRef.current.petFrog() }],
        });
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectModule = useCallback((id) => {
    const frog = frogRef.current;
    setCardOpen(false);
    setBubble(null);
    setModule(id);
    frog.module = id;
    frog.tongue = null;
    frog.vx = 0;
    frog.lastInteraction = Date.now();
    lastHitHoverRef.current = Date.now();
    if (frog.state !== "sleep") enter(frog, "module");
  }, []);

  // ---------- dormir / despertar ----------
  const sendToBed = useCallback(() => {
    const frog = frogRef.current;
    const w = worldRef.current;
    frog.dnd = true;
    const corner = frog.x < w.width / 2 ? FROG_W / 2 + 18 : w.width - FROG_W / 2 - 18;
    goTo(frog, corner, { state: "sleep", dur: 1e9 });
  }, []);

  const wakeUp = useCallback(() => {
    const frog = frogRef.current;
    petRef.current.dnd = null;
    frog.dnd = false;
    frog.lastInteraction = Date.now();
    if (frog.state === "sleep" || frog.state === "goto") enter(frog, "wake", 1);
    refreshPet();
    persist();
    say("¡Buen día! Ya estoy despierto.", 3000);
  }, [refreshPet, persist, say]);

  // ---------- caricias ----------
  const doPet = useCallback(() => {
    const frog = frogRef.current;
    const h = headPoint();
    spawn(particlesRef.current, "heart", h.x, h.y, { count: 3 });
    sound.chirp();
    boost(petRef.current, { mood: 5 });
    markCare(petRef.current);
    gainXp("pet");
    frog.lastInteraction = Date.now();
    if (isFree(frog) || frog.state === "attentive") enter(frog, "petting", 1);
    refreshPet();
  }, [gainXp, refreshPet]);

  // ---------- pomodoro ----------
  const handlePomoEvent = useCallback(
    (ev) => {
      const pomo = pomoRef.current;
      const frog = frogRef.current;
      if (ev?.type === "focusDone") {
        const mins = pomo.settings[ev.next];
        sound.chime();
        notify("¡Pomodoro completo!", `Tomate ${mins} minutos de descanso.`);
        boost(petRef.current, { mood: 8 });
        markCare(petRef.current);
        gainXp("pomodoro");
        if (frog.onGround && frog.state !== "grabbed" && frog.state !== "sleep") celebrate(frog);
        const h = headPoint();
        spawn(particlesRef.current, "sparkle", h.x, h.y, { count: 6 });
        say(`¡Bien ahí! Pomodoro #${pomo.today.count} completo. Descanso de ${mins} min.`, 10_000, [
          { label: "Saltar descanso", run: () => handlePomoEvent(pomodoro.advance(pomoRef.current)) },
        ]);
      } else if (ev?.type === "breakDone") {
        sound.chime();
        notify("Fin del descanso", "¿Arrancamos otro pomodoro?");
        say("Se terminó el descanso. ¿Otro pomodoro?", 20_000, [
          {
            label: "Empezar",
            run: () => {
              pomodoro.start(pomoRef.current, "focus");
              persist();
              refreshPomo();
            },
          },
          {
            label: "Ahora no",
            run: () => {
              pomodoro.stop(pomoRef.current);
              persist();
              refreshPomo();
            },
          },
        ]);
      }
      persist();
      refreshPomo();
      refreshPet();
    },
    [gainXp, persist, refreshPet, refreshPomo, say]
  );

  // ---------- recordatorios y hábitos ----------
  useReminders({
    onReminder: (r) => bubbleQueueRef.current.push({ text: r.text, actions: [{ label: r.actionLabel, run: () => selectModule(r.action) }] }),
    onHabits: ({ habitScore, recordCount }) => {
      const pet = petRef.current;
      pet.habitScore = habitScore;
      if (pet.recordCounts != null && recordCount > pet.recordCounts) {
        const n = recordCount - pet.recordCounts;
        boost(pet, { mood: Math.min(15, 3 * n), hunger: Math.min(10, 2 * n) });
        markCare(pet);
        const gained = gainXp("record", n);
        bubbleQueueRef.current.push({
          text:
            n === 1
              ? `¡Vi que registraste algo nuevo en el gestor! Gracias por cuidarte.${gained ? ` +${gained} XP` : ""}`
              : `¡Registraste ${n} cosas nuevas!${gained ? ` +${gained} XP` : ""}`,
        });
      }
      pet.recordCounts = recordCount;
      persist();
      refreshPet();
    },
  });

  // ---------- controlador que usa la tarjeta ----------
  const ctl = {
    pet: petView,
    pomo: pomoView,
    muted,
    setView: setCardView,
    close: closeAll,
    rename: (name) => {
      petRef.current.name = name;
      persist();
      refreshPet();
    },
    /** Antes de adoptar: cambia la especie para ver cómo queda en pantalla. */
    previewSpecies: (species) => {
      const pet = petRef.current;
      if (pet.adopted && pet.alive) return;
      pet.species = species;
      refreshPet();
    },
    adopt: ({ species, name }) => {
      const pet = petRef.current;
      adoptInto(pet, { species, name });
      persist();
      refreshPet();
      setCardView("home");
      const h = headPoint();
      spawn(particlesRef.current, "sparkle", h.x, h.y, { count: 10 });
      spawn(particlesRef.current, "heart", h.x, h.y, { count: 3 });
      sound.pop();
      say(`¡Hola! Soy ${pet.name}. Cuidame y vamos a crecer juntos.`, 5000);
    },
    toggleAccessory: (id) => {
      toggleAccessory(petRef.current, id);
      persist();
      refreshPet();
    },
    feed: () => {
      const pet = petRef.current;
      const frog = frogRef.current;
      closeAll();
      if (pet.dnd) return say("Shh… está durmiendo.", 2000);
      if (pet.stats.hunger >= 95) return say(`Estoy lleno, gracias. ${SPECIES[pet.species].sound}`, 2500);
      markCare(pet);
      const treat = createTreat(worldRef.current, frog);
      fliesRef.current.push(treat);
      frog.lastInteraction = Date.now();
      chaseFly(frog, treat.id);
    },
    petFrog: doPet,
    sleep: (minutes) => {
      petRef.current.dnd = { until: minutes ? Date.now() + minutes * 60_000 : null };
      closeAll();
      say("Me voy a dormir un rato. ¡Hasta luego!", 2500);
      sendToBed();
      persist();
      refreshPet();
    },
    wake: () => {
      wakeUp();
      setCardView("home");
    },
    pomoStart: () => {
      pomodoro.start(pomoRef.current, "focus");
      persist();
      refreshPomo();
      say("¡A concentrarse! Yo te cuido el tiempo.", 2500);
    },
    pomoPause: () => {
      pomodoro.pause(pomoRef.current);
      persist();
      refreshPomo();
    },
    pomoResume: () => {
      pomodoro.resume(pomoRef.current);
      persist();
      refreshPomo();
    },
    pomoSkip: () => handlePomoEvent(pomodoro.advance(pomoRef.current)),
    pomoStop: () => {
      pomodoro.stop(pomoRef.current);
      persist();
      refreshPomo();
    },
    pomoSettings: (patch) => {
      pomoRef.current.settings = { ...pomoRef.current.settings, ...patch };
      persist();
      refreshPomo();
    },
    openModule: selectModule,
    openApp: () => {
      closeAll();
      bridge.openApp("/fisico");
    },
    toggleMute: () => {
      sound.setMuted(!muted);
      setMutedState(!muted);
    },
    onQuickAdded: ({ text }) => {
      const pet = petRef.current;
      closeAll();
      boost(pet, { mood: 4, hunger: 3 });
      markCare(pet);
      const gained = gainXp("record");
      if (pet.recordCounts != null) pet.recordCounts += 1;
      persist();
      refreshPet();
      sound.pop();
      const frog = frogRef.current;
      if (frog.onGround && frog.state !== "sleep") celebrate(frog);
      const h = headPoint();
      spawn(particlesRef.current, "sparkle", h.x, h.y, { count: 6 });
      if (gained) spawn(particlesRef.current, "text", h.x, h.y - 20, { text: `+${gained} XP` });
      say(`¡Anotado! ${text}`, 3500);
    },
  };
  const ctlRef = useRef(ctl);
  ctlRef.current = ctl;

  // ---------- multi-monitor ----------
  const doTransfer = useCallback(
    async (gx, gy) => {
      if (transferringRef.current) return;
      transferringRef.current = true;
      const frog = frogRef.current;
      persist();
      const ok = await bridge.transfer({
        gx,
        gy,
        frog: { onGround: frog.onGround, vx: frog.vx, vy: frog.vy, facing: frog.facing, bouncy: frog.bouncy },
      });
      transferringRef.current = false;
      if (!ok) {
        const w = worldRef.current;
        frog.exiting = false;
        frog.explore = false;
        frog.x = clamp(frog.x, FROG_W / 2, w.width - FROG_W / 2);
        frog.facing = frog.x < w.width / 2 ? 1 : -1;
      }
      // Si salió bien, el main avisa el nuevo dueño y este escenario se desmonta.
    },
    [persist]
  );

  const openEdges = useCallback(
    (frog) => {
      const b = env.bounds;
      const gy = b.y + frog.y - 20;
      const others = env.displays.filter((d) => d.id !== env.displayId).map((d) => d.workArea);
      const vOverlap = (w) => gy >= w.y && gy <= w.y + w.height;
      return {
        openLeft: others.some((w) => Math.abs(w.x + w.width - b.x) < 8 && vOverlap(w)),
        openRight: others.some((w) => Math.abs(w.x - (b.x + b.width)) < 8 && vOverlap(w)),
      };
    },
    [env]
  );

  // ---------- hit-test: el overlay solo captura el mouse sobre el sapo y sus cosas ----------
  const updateHit = useCallback((x, y) => {
    if (dragRef.current) {
      bridge.setClickThrough(false);
      return;
    }
    const el = document.elementFromPoint(x, y);
    const over = !!el?.closest("[data-hit]");
    if (over) lastHitHoverRef.current = Date.now();
    bridge.setClickThrough(!over);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      updateHit(e.clientX, e.clientY);
    };
    const onResize = () => {
      const w = (worldRef.current = currentWorld(env.bounds));
      const frog = frogRef.current;
      if (frog.onGround) frog.y = w.height;
      frog.x = clamp(frog.x, FROG_W / 2, w.width - FROG_W / 2);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    // Lejos del sapo el overlay no recibe el mouse (evita que el cursor parpadee en otras ventanas):
    // la posición llega desde el main para que el sapo lo siga mirando.
    const offCursor = bridge.onCursor((p) => (mouseRef.current = { x: p.x, y: p.y, t: Date.now() }));
    const offPrefs = bridge.onPrefs((p) => (prefsRef.current = { ...prefsRef.current, ...p }));
    const offHotkey = bridge.onHotkey((view) => openCard(view));
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      offCursor();
      offPrefs();
      offHotkey();
      persist();
      bridge.setClickThrough(true);
    };
  }, [updateHit, openCard, persist, env]);

  // ---------- loop principal ----------
  useEffect(() => {
    let raf;
    let last = performance.now();
    let lastHitCheck = 0;
    let lastZones = "";

    const step = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      timeRef.current += dt;
      const now = Date.now();
      const w = worldRef.current;
      const frog = frogRef.current;
      const pet = petRef.current;
      const pomo = pomoRef.current;
      const ui = uiRef.current;
      const timers = timersRef.current;

      // Modo actual: no molestar > foco > descanso.
      const pomoActive = pomodoro.isRunning(pomo) && !pomo.paused;
      const mode = pet.dnd ? "dnd" : pomoActive && pomo.phase === "focus" ? "focus" : pomoActive ? "rest" : null;
      // Sin mascota viva (murió o todavía no se adoptó) no hay moscas ni charla.
      const petGone = !pet.alive || !pet.adopted;
      const quiet = mode !== null || petGone;

      if (pet.dnd?.until && now > pet.dnd.until) wakeUp();

      // Estados que imponen la UI o el modo.
      const settled = frog.onGround && frog.state !== "grabbed";
      if (!pet.alive && settled) {
        if (frog.state !== "attentive") enter(frog, "attentive");
      } else if (ui.cardOpen && isFree(frog)) enter(frog, "attentive");
      else if (ui.module && isFree(frog)) enter(frog, "module");
      else if (!ui.cardOpen && !ui.module && settled) {
        const canPark = isFree(frog) || frog.state === "focus" || frog.state === "rest";
        if (mode === "dnd" && canPark) sendToBed();
        else if (mode === "focus" && (isFree(frog) || frog.state === "rest")) enter(frog, "focus");
        else if (mode === "rest" && (isFree(frog) || frog.state === "focus")) enter(frog, "rest");
        else if (!mode && (frog.state === "focus" || frog.state === "rest")) enter(frog, "idle", 1);
      }

      // Moscas
      if (!quiet && now >= timers.nextFlyAt) {
        if (fliesRef.current.filter((f) => !f.treat).length < 2) fliesRef.current.push(createFly(w));
        timers.nextFlyAt = now + (pet.stats.hunger < 40 ? rand(30_000, 90_000) : rand(60_000, 180_000));
      }
      fliesRef.current = fliesRef.current.filter((f) => !f.dead && stepFly(f, dt, w));

      // Sapo
      const events = stepFrog(frog, dt, {
        ...w,
        ...openEdges(frog),
        now,
        flies: fliesRef.current,
        mouse: mouseRef.current,
        prefs: prefsRef.current,
        pet: pet.stats,
        quiet,
      });
      for (const e of events) {
        if (e.type === "croak") {
          if (pet.species === "zorro") sound.chirp();
          else sound.croak();
          if (!ui.bubble && !quiet) say(SPECIES[pet.species].sound, 1500);
        } else if (e.type === "happy") {
          const h = headPoint();
          spawn(particlesRef.current, "note", h.x, h.y, { count: 2 });
        } else if (e.type === "tongueOut") {
          sound.thwip();
        } else if (e.type === "flyCaught") {
          const fly = fliesRef.current.find((f) => f.id === e.id);
          if (fly) fly.dead = true;
          const food = e.treat ? 18 : 12;
          boost(pet, { hunger: food, mood: e.treat ? 4 : 2 });
          pet.flies += 1;
          gainXp(e.treat ? "feed" : "fly");
          const m = mouthPoint(frog);
          spawn(particlesRef.current, "text", m.x, m.y - 30, { text: `+${food}`, color: "#e08a00" });
          if (e.treat) spawn(particlesRef.current, "heart", m.x, m.y - 20, { count: 2 });
          refreshPet();
        } else if (e.type === "gulp") {
          sound.gulp();
        } else if (e.type === "bounce") {
          sound.boing();
        } else if (e.type === "yankStart") {
          const yank = { ok: false, x: e.x, y: e.y };
          yankRef.current = yank;
          bridge.yankStart().then((ok) => (yank.ok = ok));
        } else if (e.type === "cursorTo") {
          const y = yankRef.current;
          if (y?.ok && Math.hypot(e.x - y.x, e.y - y.y) <= MAX_CURSOR_PULL) bridge.cursorTo({ x: e.x, y: e.y });
        } else if (e.type === "exitEdge") {
          const b = env.bounds;
          doTransfer(e.side === "left" ? b.x - 2 : b.x + b.width + 2, b.y + frog.y - 20);
        }
      }
      if (!frog.tongue) yankRef.current = null;

      // Mascota y pomodoro (una vez por segundo alcanza).
      timers.petAcc += dt;
      timers.saveAcc += dt;
      if (timers.petAcc >= 1) {
        // La compañía cuenta solo con la mascota despierta (no en "no molestar").
        const { presenceXp } = tickPet(pet, timers.petAcc, { asleep: frog.state === "sleep" || !!pet.dnd });
        timers.petAcc = 0;
        if (presenceXp) gainXp("presence", presenceXp);
        if (shouldDie(pet)) handleDeath();
        else if (pet.alive && pet.criticalSince != null && now - timers.lastCriticalWarn > 30 * 60_000 && !ui.cardOpen) {
          timers.lastCriticalWarn = now;
          const hrs = Math.ceil(hoursToDeath(pet));
          say(`¡${pet.name} está muy grave! Si no lo cuidás, se muere en ${hrs} ${hrs === 1 ? "hora" : "horas"}.`, 20_000, [
            { label: "Alimentar", run: () => ctlRef.current.feed() },
            { label: "Mimos", run: () => ctlRef.current.petFrog() },
          ]);
        }
        const ev = pomodoro.tick(pomo);
        if (ev) handlePomoEvent(ev);
        setPetView(structuredClone(pet));
        if (pomodoro.isRunning(pomo)) setPomoView(structuredClone(pomo));
      }
      if (timers.saveAcc >= 10) {
        timers.saveAcc = 0;
        persist();
      }

      if (frog.state === "sleep") {
        timers.zAcc += dt;
        if (timers.zAcc > 1.6) {
          timers.zAcc = 0;
          const h = headPoint();
          spawn(particlesRef.current, "text", h.x + 34, h.y - 4, { text: "z", color: "#6d7cff" });
        }
      }
      particlesRef.current = stepParticles(particlesRef.current, dt);

      // Globitos: vencimiento, recordatorios en cola y charla ocasional.
      if (ui.bubble && now > ui.bubble.until) setBubble(null);
      const calm = !ui.cardOpen && !ui.module && !quiet && frog.state !== "grabbed" && frog.state !== "sleep";
      if (!ui.bubble && calm) {
        if (bubbleQueueRef.current.length) {
          const r = bubbleQueueRef.current.shift();
          say(r.text, 12_000, r.actions);
        } else if (now >= timers.nextChatterAt && isFree(frog)) {
          const s = pet.stats;
          if (s.hunger < 30) say("Tengo hambre… ¿me das algo?", 8000, [{ label: "Alimentar", run: () => ctlRef.current.feed() }]);
          else if (s.energy < 25) say("Estoy muy cansado…", 8000, [{ label: "Dormir 30 min", run: () => ctlRef.current.sleep(30) }]);
          else if (s.mood < 30) say("Me siento solo. ¿Unos mimos?", 8000, [{ label: "Mimos", run: () => ctlRef.current.petFrog() }]);
          else {
            const lines = [SPECIES[pet.species].soft, ...CHATTER];
            say(lines[Math.floor(Math.random() * lines.length)], 5000);
          }
          timers.nextChatterAt = now + rand(6, 12) * 60_000;
        }
      }

      // Cerrar tarjeta/panel si el usuario se fue a hacer otra cosa (salvo que esté escribiendo).
      const idleFor = now - lastHitHoverRef.current;
      const typing = document.activeElement?.tagName === "INPUT";
      if ((ui.cardOpen && !typing && idleFor > CARD_IDLE_CLOSE_MS) || (ui.module && idleFor > PANEL_IDLE_CLOSE_MS)) closeAll();

      // El sapo se mueve debajo de un cursor quieto: rehacemos el hit-test cada tanto.
      if (t - lastHitCheck > 150) {
        lastHitCheck = t;
        if (mouseRef.current) updateHit(mouseRef.current.x, mouseRef.current.y);
        // Zonas interactivas (redondeadas para no mandar un mensaje por cada píxel que se mueve el sapo).
        const zones = [...document.querySelectorAll("[data-hit]")]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => [Math.floor(r.left / 8) * 8, Math.floor(r.top / 8) * 8, Math.ceil(r.width / 8) * 8 + 8, Math.ceil(r.height / 8) * 8 + 8]);
        const key = zones.join(";");
        if (key !== lastZones) {
          lastZones = key;
          bridge.setHitZones(zones);
        }
      }

      setFrame((n) => (n + 1) % 1_000_000);
    };
    // Un error en un cuadro no puede frenar la animación para siempre (el sapo quedaba congelado).
    let lastErrorLog = 0;
    // Pausa pedida por el main (p. ej. mientras se arrastra la ventana del gestor).
    let paused = false;
    const offPause = bridge.onPause((p) => (paused = !!p));
    const loop = (t) => {
      if (paused) {
        last = t;
        raf = requestAnimationFrame(loop);
        return;
      }
      try {
        step(t);
      } catch (err) {
        last = t;
        if (t - lastErrorLog > 5000) {
          lastErrorLog = t;
          console.error("[sapo] error en el loop", err);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      offPause();
    };
    // El loop lee todo desde refs; se arma una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- interacción con el sapo ----------
  function handleFrogClick() {
    const frog = frogRef.current;
    const now = Date.now();
    frog.lastInteraction = now;
    clicksRef.current = [...clicksRef.current.filter((c) => now - c < 2500), now];

    if (clicksRef.current.length >= 5) {
      clicksRef.current = [];
      closeAll();
      enter(frog, "croak", 1.2);
      sound.croak();
      say("¡Basta, me hacés cosquillas!", 2500);
      return;
    }
    if (cardOpen || module) {
      closeAll();
      return;
    }
    const pet = petRef.current;
    if (!pet.alive || !pet.adopted) {
      openCard("adopt");
      return;
    }
    if (frog.state === "sleep" && !frog.dnd) {
      enter(frog, "wake", 0.9);
      say("¿Eh? ¡Estaba durmiendo!", 2500);
      return;
    }
    openCard("home");
    sound.chirp();
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const frog = frogRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      offX: e.clientX - frog.x,
      offY: e.clientY - frog.y,
      moved: false,
      hist: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
    };
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    const frog = frogRef.current;
    if (!drag) {
      // Caricia: mover el mouse de un lado a otro sobre el sapo.
      if (Math.abs(e.movementX) < 2) return;
      const pt = petTrackRef.current;
      const dir = Math.sign(e.movementX);
      if (dir === pt.dir) return;
      const now = Date.now();
      pt.dir = dir;
      pt.flips = [...pt.flips.filter((f) => now - f < 1200), now];
      if (pt.flips.length >= 5 && now - pt.last > 2000) {
        pt.flips = [];
        pt.last = now;
        doPet();
      }
      return;
    }
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.moved = true;
      setCardOpen(false);
      setModule(null);
      setBubble(null);
      frog.module = null;
      frog.tongue = null;
      frog.resume = null;
      frog.gotoX = null;
      frog.onGround = false;
      enter(frog, "grabbed");
    }
    if (drag.moved) {
      frog.x = e.clientX - drag.offX;
      frog.y = Math.min(e.clientY - drag.offY, worldRef.current.height);
      drag.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (drag.hist.length > 8) drag.hist.shift();
    }
  }

  function onPointerUp(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const frog = frogRef.current;
    frog.lastInteraction = Date.now();
    if (!drag.moved) {
      handleFrogClick();
      return;
    }
    const nowT = performance.now();
    const recent = drag.hist.filter((h) => nowT - h.t < 100);
    const first = recent[0] ?? drag.hist.at(-1);
    const lastP = drag.hist.at(-1);
    const span = Math.max(16, lastP.t - first.t) / 1000;
    const vx = (lastP.x - first.x) / span;
    const vy = (lastP.y - first.y) / span;
    throwFrog(frog, vx, vy);
    if (Math.hypot(vx, vy) > 1500) say("¡Wiiiii!", 1500);

    // Soltado en otro monitor: lo mandamos para allá.
    const w = worldRef.current;
    if (e.clientX < 0 || e.clientX >= w.width || e.clientY < 0 || e.clientY >= w.height) {
      doTransfer(env.bounds.x + e.clientX, env.bounds.y + e.clientY);
    } else {
      frog.x = clamp(frog.x, FROG_W / 2, w.width - FROG_W / 2);
    }
  }

  function swatFly(id) {
    const fly = fliesRef.current.find((f) => f.id === id);
    if (fly) fly.dead = true;
    if (Math.random() < 0.6) say("¡Ey! ¡Esa era mía!", 2000);
  }

  // ---------- render ----------
  const frog = frogRef.current;
  const world = worldRef.current;
  const pet = petRef.current;
  const pomo = pomoRef.current;
  const pose = poseOf(frog);
  const expression = expressionOf(frog, pet, pose);
  const accessory = frog.state === "sleep" && frog.dnd ? "nightcap" : frog.state === "focus" ? "focus" : frog.state === "rest" ? "rest" : null;

  let lookTarget = null;
  if (frog.tongue) lookTarget = { x: frog.tongue.tx, y: frog.tongue.ty };
  else if (frog.state === "chase") lookTarget = fliesRef.current.find((f) => f.id === frog.targetFlyId) ?? null;
  else if (mouseRef.current && Date.now() - mouseRef.current.t < 4000) lookTarget = mouseRef.current;
  let look = { x: frog.facing * 0.5, y: 0.2 };
  if (lookTarget) {
    const dx = lookTarget.x - frog.x;
    const dy = lookTarget.y - (frog.y - FROG_H * 0.7);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 120);
    look = { x: (dx / d) * k, y: (dy / d) * k };
  }
  look = { x: Math.round(look.x * 10) / 10, y: Math.round(look.y * 10) / 10 };

  let sy = 1;
  if (!frog.onGround && frog.state !== "grabbed" && !frog.bouncy) sy = 1 + Math.min(0.16, Math.max(-0.12, -frog.vy / 2400));
  const sx = 1 / Math.sqrt(sy);

  const shadowK = clamp(1 - (world.height - frog.y) / 450, 0.25, 1);
  const dozing = frog.dnd && frog.state === "sleep";

  const showBadge = pomodoro.isRunning(pomo) && !cardOpen;
  const Panel = module ? PANELS[module] : null;
  const panelOnRight = frog.x + FROG_W / 2 + 12 + PANEL_W <= world.width;
  const panelLeft = panelOnRight ? frog.x + FROG_W / 2 + 12 : Math.max(8, frog.x - FROG_W / 2 - 12 - PANEL_W);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {fliesRef.current.map((f) => (
        <Fly key={f.id} fly={f} onSwat={swatFly} />
      ))}

      <div
        style={{
          position: "absolute",
          left: frog.x - 46 * shadowK,
          top: world.height - 9,
          width: 92 * shadowK,
          height: 12 * shadowK,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(0,0,0,0.22), rgba(0,0,0,0))",
          opacity: dozing ? 0.6 : 1,
          pointerEvents: "none",
        }}
      />

      <div
        data-hit
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute",
          left: frog.x - FROG_W / 2,
          top: frog.y - FROG_H,
          width: FROG_W,
          height: FROG_H,
          cursor: frog.state === "grabbed" ? "grabbing" : "grab",
          touchAction: "none",
          opacity: dozing ? 0.85 : 1,
          transition: "opacity 0.6s",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.12))",
        }}
      >
        <div style={{ transform: `scale(${sx}, ${sy})`, transformOrigin: "50% 100%" }}>
          <Frog
            species={pet.species}
            ghost={!pet.alive}
            pose={pose}
            expression={expression}
            look={look}
            sick={pet.stats.health < 30}
            accessory={accessory}
            module={frog.state === "module" ? frog.module : null}
          />
        </div>
      </div>

      {frog.tongue && frog.tongue.phase !== "aim" && <Tongue mouth={mouthPoint(frog)} tongue={frog.tongue} time={timeRef.current} />}

      <Particles list={particlesRef.current} />

      <AnimatePresence>
        {showBadge && <PomodoroBadge key="badge" pomo={pomoView} x={frog.x} y={frog.y - FROG_H - 6} onClick={() => openCard("pomodoro")} />}
      </AnimatePresence>

      <AnimatePresence>
        {cardOpen && (
          <PetCard
            key="card"
            ctl={ctl}
            view={cardView}
            left={clamp(frog.x - CARD_W / 2, 8, world.width - CARD_W - 8)}
            bottom={world.height - (frog.y - FROG_H) + 14}
            maxHeight={Math.max(240, frog.y - FROG_H - 30)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {Panel && (
          <motion.div
            key={module}
            data-hit
            initial={{ opacity: 0, x: panelOnRight ? -16 : 16, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="frog-scroll"
            style={{ position: "absolute", left: panelLeft, bottom: 12, width: PANEL_W, maxHeight: world.height - 24, overflowY: "auto" }}
          >
            <Panel onClose={closeAll} onBack={() => openCard("home")} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bubble && !cardOpen && !module && (
          <SpeechBubble
            key={bubble.id}
            bubble={bubble}
            frog={frog}
            world={world}
            frogHeight={FROG_H}
            lift={showBadge ? 30 : 0}
            onClose={() => setBubble(null)}
            onAction={(a) => {
              setBubble(null);
              a.run();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// =====================================================================
// Raíz: cada monitor tiene su ventana; solo la "dueña" muestra al sapo.
// =====================================================================

export function FrogWidget() {
  const [env, setEnv] = useState(null);
  const [owner, setOwner] = useState({ isOwner: false, epoch: 0, arrival: null });
  const envRef = useRef(null);

  useEffect(() => {
    bridge.setClickThrough(true);
    bridge.init().then((info) => {
      envRef.current = info;
      setEnv(info);
      setOwner((o) => ({ ...o, isOwner: info.isOwner }));
    });
    const offOwner = bridge.onOwner((id) => {
      if (envRef.current && id !== envRef.current.displayId) setOwner((o) => ({ ...o, isOwner: false }));
    });
    const offArrive = bridge.onArrive((arrival) => setOwner((o) => ({ isOwner: true, epoch: o.epoch + 1, arrival })));
    return () => {
      offOwner();
      offArrive();
    };
  }, []);

  if (!env || !owner.isOwner) return null;
  // Si algo del sapo falla al renderizar no mostramos nada (nunca un cartel en el escritorio) y
  // reintentamos a los pocos segundos.
  return (
    <ErrorBoundary fallback={null} retryMs={3000} resetKey={owner.epoch}>
      <FrogStage key={owner.epoch} env={env} arrival={owner.arrival} />
    </ErrorBoundary>
  );
}
