import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, ExternalLink, FileText } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { DeleteButton } from "../common/DeleteButton.jsx";
import { EditButton } from "../common/EditButton.jsx";
import { CertificateForm } from "./CertificateForm.jsx";
import { formatShortDate, todayDateInputValue } from "../../lib/format.js";

export function splitSkills(skills) {
  return (skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function Thumbnail({ cert }) {
  const fileUrl = cert.fileName ? `/certificates/${cert.fileName}` : null;
  const isImage = cert.mimeType?.startsWith("image/");
  const box = "flex items-center justify-center rounded-lg shrink-0 overflow-hidden";
  const style = { width: 52, height: 52, background: "var(--accent-soft)", color: "var(--accent-strong)", border: "1px solid var(--border)" };

  if (!fileUrl) {
    return (
      <span className={box} style={style}>
        <Award size={20} />
      </span>
    );
  }
  return (
    <a href={fileUrl} target="_blank" rel="noreferrer" className={box} style={style} aria-label="Abrir certificado">
      {isImage ? <img src={fileUrl} alt="" className="w-full h-full object-cover" /> : <FileText size={20} />}
    </a>
  );
}

function CertificateRow({ cert, onEdit, onDelete }) {
  const issued = cert.issuedAt ? `${formatShortDate(cert.issuedAt)} ${cert.issuedAt.slice(0, 4)}` : null;
  const expired = cert.expiresAt && cert.expiresAt < todayDateInputValue();
  const meta = [cert.issuer, issued, cert.hours ? `${cert.hours} h` : null].filter(Boolean).join(" · ");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-3 px-5 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <Thumbnail cert={cert} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{cert.title}</p>
        {meta && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {meta}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {expired && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: "var(--danger)", background: "var(--danger-soft)" }}>
              Vencido
            </span>
          )}
          {splitSkills(cert.skills).map((s) => (
            <span key={s} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: "var(--text-muted)", background: "var(--surface-alt)" }}>
              {s}
            </span>
          ))}
          {cert.verifyUrl && (
            <a
              href={cert.verifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
              style={{ color: "var(--accent-strong)" }}
            >
              <ExternalLink size={10} />
              Verificar
            </a>
          )}
        </div>
      </div>
      <EditButton onClick={onEdit} label="Editar" />
      <DeleteButton onClick={onDelete} label="Borrar" />
    </motion.div>
  );
}

export function CertificateList({ certificates, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <SectionHeading icon={Award}>Mis certificados</SectionHeading>
      </div>
      {certificates.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState icon={Award}>Todavía no cargaste certificados.</EmptyState>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AnimatePresence initial={false}>
            {certificates.map((cert) =>
              editingId === cert.id ? (
                <div key={cert.id} className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <CertificateForm
                    initial={cert}
                    onSubmit={async (formData) => {
                      await onUpdate(cert.id, formData);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <CertificateRow key={cert.id} cert={cert} onEdit={() => setEditingId(cert.id)} onDelete={() => onDelete(cert.id)} />
              )
            )}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
