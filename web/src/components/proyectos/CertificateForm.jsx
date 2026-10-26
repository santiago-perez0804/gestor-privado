import { useRef, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";

const FIELDS = ["title", "issuer", "issuedAt", "expiresAt", "hours", "credentialId", "verifyUrl", "skills", "notes"];

const ERRORS = {
  invalid_file_type: "El archivo tiene que ser PDF o imagen.",
  "File too large": "El archivo supera los 10 MB.",
  title_required: "Falta el nombre del curso.",
};

/** Formulario compartido para alta y edición. `initial` presente = modo edición. */
export function CertificateForm({ initial, onSubmit, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELDS.map((k) => [k, initial?.[k] ?? ""]))
  );
  const [removeFile, setRemoveFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!values.title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (const k of FIELDS) formData.append(k, String(values[k]).trim());
      const file = fileRef.current?.files?.[0];
      if (file) formData.append("file", file);
      else if (removeFile) formData.append("removeFile", "true");
      await onSubmit(formData);
      if (!initial) {
        setValues(Object.fromEntries(FIELDS.map((k) => [k, ""])));
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (err) {
      setError(ERRORS[err.message] || "No se pudo guardar el certificado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div>
        <FieldLabel>Curso / certificado</FieldLabel>
        <input value={values.title} onChange={set("title")} placeholder="Ej. React desde cero" className={inputClass()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Institución</FieldLabel>
          <input value={values.issuer} onChange={set("issuer")} placeholder="Ej. Platzi" className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Horas</FieldLabel>
          <input type="number" min="0" step="0.5" value={values.hours} onChange={set("hours")} placeholder="0" className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Obtenido</FieldLabel>
          <input type="date" value={values.issuedAt} onChange={set("issuedAt")} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Vence (opcional)</FieldLabel>
          <input type="date" value={values.expiresAt} onChange={set("expiresAt")} className={inputClass()} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>ID de credencial</FieldLabel>
          <input value={values.credentialId} onChange={set("credentialId")} className={inputClass()} />
        </div>
        <div>
          <FieldLabel>Link de verificación</FieldLabel>
          <input type="url" value={values.verifyUrl} onChange={set("verifyUrl")} placeholder="https://…" className={inputClass()} />
        </div>
      </div>
      <div>
        <FieldLabel>Habilidades (separadas por coma)</FieldLabel>
        <input value={values.skills} onChange={set("skills")} placeholder="react, javascript, css" className={inputClass()} />
      </div>
      <div>
        <FieldLabel>{initial?.fileName ? "Reemplazar archivo (PDF o imagen)" : "Archivo (PDF o imagen)"}</FieldLabel>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className={inputClass()} />
        {initial?.fileName && (
          <label className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            <input type="checkbox" checked={removeFile} onChange={(e) => setRemoveFile(e.target.checked)} />
            Quitar el archivo actual
          </label>
        )}
      </div>
      <input value={values.notes} onChange={set("notes")} placeholder="Notas" className={inputClass()} />
      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {initial ? (
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Guardar
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Agregar certificado
        </button>
      )}
    </form>
  );
}
