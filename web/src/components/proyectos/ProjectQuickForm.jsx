import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { IconPicker } from "../common/IconPicker.jsx";
import { InstagramTokenHelp } from "./InstagramTokenHelp.jsx";
import { PROJECT_ICONS } from "../../lib/icons.js";

const ERRORS = {
  invalid_token: "Instagram rechazó el token. Revisá que esté completo y que la cuenta sea profesional.",
};

export function ProjectQuickForm({ onAdd }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAdd({ name: name.trim(), icon, type: "instagram", accessToken: accessToken.trim() || undefined });
      setName("");
      setIcon(null);
      setAccessToken("");
    } catch (err) {
      setError(ERRORS[err.message] || "No se pudo crear el proyecto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <SectionHeading icon={Plus}>Nuevo proyecto</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex items-end gap-2">
          <IconPicker value={icon} autoIconName="Instagram" options={PROJECT_ICONS} onChange={setIcon} />
          <div className="flex-1">
            <FieldLabel>Nombre</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cuenta de libros" className={inputClass()} />
          </div>
        </div>
        <div>
          <FieldLabel>Token de Instagram (opcional, se puede cargar después)</FieldLabel>
          <input
            type="password"
            autoComplete="off"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="IGAA…"
            className={inputClass()}
          />
        </div>
        <InstagramTokenHelp />
        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Crear
        </button>
      </form>
    </Card>
  );
}
