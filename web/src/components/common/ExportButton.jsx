import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api } from "../../lib/api.js";

export function ExportButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(api.exportUrl);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fisico-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      aria-label="Exportar datos"
      title="Exportar todos los datos (JSON)"
      className="hover-surface flex items-center justify-center rounded-lg"
      style={{ width: 32, height: 32, color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
    </button>
  );
}
