import { AnimatePresence, motion } from "framer-motion";
import { HomeView } from "./HomeView.jsx";
import { QuickAddView } from "./QuickAddView.jsx";
import { SleepView } from "./SleepView.jsx";
import { PomodoroView } from "./PomodoroView.jsx";
import { AdoptView } from "./AdoptView.jsx";

export const CARD_W = 328;

const VIEWS = { home: HomeView, quick: QuickAddView, sleep: SleepView, pomodoro: PomodoroView, adopt: AdoptView };

/** Tarjeta flotante sobre el sapo con su estado, acciones y sub-vistas. */
export function PetCard({ ctl, view, left, bottom, maxHeight }) {
  // Sin mascota viva, la única vista posible es la de adopción.
  const View = !ctl.pet.alive || !ctl.pet.adopted ? AdoptView : VIEWS[view] ?? HomeView;
  return (
    <div style={{ position: "absolute", left, bottom, width: CARD_W }}>
      <motion.div
        data-hit
        initial={{ opacity: 0, y: 14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        style={{ transformOrigin: "50% 100%" }}
        className="rounded-[22px] overflow-hidden"
      >
        <div
          className="frog-scroll overflow-y-auto overflow-x-hidden p-4"
          style={{
            maxHeight,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 22,
            boxShadow: "0 18px 50px -18px rgba(0,0,0,0.45), var(--shadow-md)",
            color: "var(--text)",
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, x: view === "home" ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: view === "home" ? 12 : -12 }}
              transition={{ duration: 0.16 }}
            >
              <View ctl={ctl} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
