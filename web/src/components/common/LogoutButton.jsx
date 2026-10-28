import { LogOut } from "lucide-react";
import { currentSession, signOut } from "../../lib/auth.js";

/** Cerrar sesión (solo aparece cuando la app tiene login, o sea en la nube). */
export function LogoutButton({ className = "", style }) {
  const s = currentSession();
  if (!s?.authRequired) return null;
  return (
    <button onClick={() => signOut()} className={`hover-surface flex items-center justify-center w-8 h-8 shrink-0 ${className}`} style={{ color: "var(--text-muted)", ...style }} aria-label="Cerrar sesión" title={s.email ? `Cerrar sesión (${s.email})` : "Cerrar sesión"}>
      <LogOut size={15} />
    </button>
  );
}
