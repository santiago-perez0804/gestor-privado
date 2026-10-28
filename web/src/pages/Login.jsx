import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { signIn } from "../lib/auth.js";

/** Pantalla de inicio de sesión (la única parte pública de la app). Al entrar, recarga en la misma pantalla. */
export function Login({ expired = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(expired ? "Tu sesión venció. Volvé a entrar." : null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10" style={{ background: "var(--bg)" }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl p-6 sm:p-8 space-y-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon.svg" alt="" width="72" height="72" className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-semibold">Gestor</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Entrá con tu cuenta para ver tus datos.
            </p>
          </div>
        </div>
        <label className="block">
          <span className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
            Email
          </span>
          <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 rounded-lg px-3 text-base" />
        </label>
        <label className="block">
          <span className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
            Contraseña
          </span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-11 rounded-lg px-3 text-base" />
        </label>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          Entrar
        </button>
      </form>
    </main>
  );
}
