import { HelpCircle } from "lucide-react";

export function InstagramTokenHelp() {
  return (
    <details className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}>
      <summary className="flex items-center gap-1.5 cursor-pointer font-medium" style={{ color: "var(--text)" }}>
        <HelpCircle size={13} />
        ¿Cómo consigo el token?
      </summary>
      <ol className="list-decimal pl-4 mt-2 space-y-1.5">
        <li>
          En la app de Instagram: Configuración → Tipo de cuenta → <b>Cambiar a cuenta profesional → Creador</b>.
        </li>
        <li>
          En <b>developers.facebook.com</b> creá una app y agregá el producto <b>Instagram → API setup with Instagram login</b>.
        </li>
        <li>
          En <b>Roles de la app</b> agregá tu cuenta como <b>Instagram Tester</b> y aceptá la invitación desde Instagram
          (Configuración → Apps y sitios web).
        </li>
        <li>
          En el panel del producto, tocá <b>Generate access token</b> para tu cuenta y pegalo acá. Dura 60 días y la app lo
          renueva sola.
        </li>
      </ol>
      <p className="mt-2" style={{ color: "var(--text-faint)" }}>
        El token queda guardado solo en el servidor; nunca se devuelve al navegador ni se incluye en el export.
      </p>
    </details>
  );
}
