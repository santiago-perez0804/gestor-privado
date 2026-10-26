import { useState } from "react";
import { AlertTriangle, AppWindow, Cookie, Flame, HandHeart, Heart, Lock, Moon, Pencil, Repeat, Settings, Smile, Sun, Timer, Utensils, Volume2, VolumeX, Zap } from "lucide-react";
import { MODULES } from "../../modules.js";
import { FrogAvatar } from "../Frog.jsx";
import { FlySprite } from "../Fly.jsx";
import { STATS, statusWord, moodSummary, xpToNext, ageDays, todayProgress, hoursToDeath, daysWithoutCare, SPECIES } from "../pet.js";
import { ACCESSORIES, nextUnlock } from "../accessories.js";
import { isRunning, remainingMs, formatClock } from "../pomodoro.js";
import { STAT_STYLE } from "./ui.jsx";
import { isDesktop, openSettings } from "../bridge.js";

const STAT_ICONS = { health: Heart, hunger: Utensils, energy: Moon, mood: Smile };
const TONE = {
  good: { bg: "rgba(34, 176, 125, 0.14)", fg: "#1a9a6b" },
  calm: { bg: "var(--surface-alt)", fg: "var(--text-muted)" },
  warn: { bg: "rgba(245, 158, 11, 0.16)", fg: "#b7770a" },
  bad: { bg: "rgba(239, 91, 115, 0.15)", fg: "#d6455f" },
};

function NameEditor({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onRename(draft.trim().slice(0, 18));
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          maxLength={18}
          className="text-[15px] font-semibold rounded-md px-1.5 py-0.5 w-36 outline-none"
          style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
        />
      </form>
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      className="group flex items-center gap-1.5 text-[15px] font-semibold leading-tight"
      title="Cambiar nombre"
    >
      {name}
      <Pencil size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

function StatTile({ statKey, label, value }) {
  const Icon = STAT_ICONS[statKey];
  const st = STAT_STYLE[statKey];
  const low = value < 25;
  return (
    <div className="rounded-xl p-2.5" style={{ background: st.soft }}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} style={{ color: st.color }} strokeWidth={2.4} />
        <span className="text-[11px] font-semibold flex-1" style={{ color: "var(--text)" }}>
          {label}
        </span>
        <span className="text-[11px] font-mono font-semibold" style={{ color: st.color }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(127,127,127,0.18)" }}>
        <div
          className={`h-full rounded-full ${low ? "stat-low" : ""}`}
          style={{ width: `${value}%`, background: st.color, transition: "width 0.6s ease" }}
        />
      </div>
      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
        {statusWord(statKey, value)}
      </p>
    </div>
  );
}

function Action({ icon: Icon, label, onClick, active, badge }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-transform hover:-translate-y-0.5"
      style={{
        background: active ? "var(--accent-soft)" : "var(--surface-alt)",
        color: active ? "var(--accent-strong)" : "var(--text)",
      }}
    >
      <Icon size={17} strokeWidth={2.2} />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
      {badge && (
        <span
          className="absolute -top-1.5 -right-1 rounded-full px-1.5 py-[1px] text-[9px] font-mono font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function HomeView({ ctl }) {
  const { pet, pomo, muted } = ctl;
  const summary = moodSummary(pet);
  const tone = TONE[summary.tone];
  const need = xpToNext(pet.level);
  const pomoActive = isRunning(pomo);
  const today = todayProgress(pet);
  const upcoming = nextUnlock(pet.level);
  const critical = pet.criticalSince != null;
  const lonelyDays = Math.floor(daysWithoutCare(pet));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: 46, height: 46, background: "var(--accent-soft)" }}>
          <FrogAvatar size={36} sick={pet.stats.health < 30} species={pet.species} />
        </div>
        <div className="min-w-0 flex-1">
          <NameEditor name={pet.name} onRename={ctl.rename} />
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--accent-strong)" }}>
              Nivel {pet.level}
            </span>
            <span>·</span>
            <span>{SPECIES[pet.species]?.label}</span>
            <span>·</span>
            <span>{ageDays(pet) === 0 ? "nació hoy" : `${ageDays(pet)} días`}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5" title="Moscas comidas">
              <FlySprite size={12} />
              <span className="font-mono">{pet.flies}</span>
            </span>
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0" style={{ background: tone.bg, color: tone.fg }}>
          {summary.text}
        </span>
      </div>

      <div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
          <div className="h-full rounded-full" style={{ width: `${(pet.xp / need) * 100}%`, background: "linear-gradient(90deg, #7fd48b, #22b07d)" }} />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-1 font-mono" style={{ color: "var(--text-faint)" }}>
          <span title="XP ganada hoy / máximo diario">
            hoy {today.earned}/{today.max}
            {today.streak > 1 && (
              <span className="inline-flex items-center gap-0.5 ml-1.5" style={{ color: "#e0782a" }} title="Días seguidos">
                <Flame size={10} />
                {today.streak}
              </span>
            )}
          </span>
          <span>
            {pet.xp}/{need} XP
          </span>
        </div>
      </div>

      {(critical || lonelyDays >= 2) && (
        <div className="rounded-xl p-2.5 flex gap-2 items-start text-[11px]" style={{ background: "rgba(239, 91, 115, 0.13)", color: "#d6455f" }}>
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <span>
            {critical
              ? `¡Está muy grave! Si no lo cuidás se muere en ${Math.ceil(hoursToDeath(pet))} h. Alimentalo, dale mimos o registrá algo en el gestor.`
              : `Hace ${lonelyDays} días que nadie lo cuida y se está debilitando. Un mimo o una comida alcanzan.`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {STATS.map((s) => (
          <StatTile key={s.key} statKey={s.key} label={s.label} value={pet.stats[s.key]} />
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        <Action icon={Cookie} label="Alimentar" onClick={ctl.feed} />
        <Action icon={HandHeart} label="Mimos" onClick={ctl.petFrog} />
        {pet.dnd ? (
          <Action icon={Sun} label="Despertar" onClick={ctl.wake} active />
        ) : (
          <Action icon={Moon} label="Dormir" onClick={() => ctl.setView("sleep")} />
        )}
        <Action
          icon={Timer}
          label="Pomodoro"
          onClick={() => ctl.setView("pomodoro")}
          active={pomoActive}
          badge={pomoActive ? formatClock(remainingMs(pomo)) : null}
        />
        <Action icon={Zap} label="Cargar" onClick={() => ctl.setView("quick")} />
      </div>

      {ACCESSORIES.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-faint)" }}>
            Accesorios{upcoming ? ` · próximo en nivel ${upcoming.level}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ACCESSORIES.map((a) => {
              const locked = a.level > pet.level;
              const on = pet.equipped?.includes(a.id);
              return (
                <button
                  key={a.id}
                  disabled={locked}
                  onClick={() => ctl.toggleAccessory(a.id)}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1"
                  title={locked ? `Se desbloquea en nivel ${a.level}` : on ? "Sacar" : "Ponérselo"}
                  style={{
                    background: on ? "var(--accent)" : "var(--surface-alt)",
                    color: on ? "#fff" : locked ? "var(--text-faint)" : "var(--text)",
                  }}
                >
                  {locked && <Lock size={9} />}
                  {a.name}
                  {locked && <span className="font-mono">nv {a.level}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-faint)" }}>
          Resúmenes
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => ctl.openModule(m.id)}
              className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <m.icon size={15} style={{ color: "var(--accent)" }} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={ctl.openApp}
          className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 mt-2"
          style={{ color: "var(--accent-strong)", background: "var(--accent-soft)" }}
        >
          <AppWindow size={13} />
          Abrir gestor
        </button>
        <span className="text-[10px] font-mono mt-2 flex-1 text-right" style={{ color: "var(--text-faint)" }}>
          Ctrl+Alt+S carga rápida
        </span>
        {isDesktop && (
          <button
            onClick={openSettings}
            className="rounded-full p-1.5 mt-2"
            style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
            aria-label="Configuración"
            title="Configuración"
          >
            <Settings size={13} />
          </button>
        )}
        <button
          onClick={() => ctl.setView("adopt")}
          className="rounded-full p-1.5 mt-2"
          style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
          aria-label="Cambiar mascota"
          title="Cambiar mascota"
        >
          <Repeat size={13} />
        </button>
        <button
          onClick={ctl.toggleMute}
          className="rounded-full p-1.5 mt-2"
          style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          title={muted ? "Activar sonido" : "Silenciar"}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </div>
    </div>
  );
}
