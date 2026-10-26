import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, subtitle, action }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={() => navigate(-1)}
        aria-label="Volver"
        className="page-back flex items-center justify-center rounded-lg shrink-0"
        style={{ width: 32, height: 32, color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        <ArrowLeft size={15} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
