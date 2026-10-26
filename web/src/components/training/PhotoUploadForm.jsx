import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Card } from "../common/Card.jsx";
import { SectionHeading } from "../common/SectionHeading.jsx";
import { FieldLabel, inputClass } from "../common/FieldLabel.jsx";
import { todayDateInputValue } from "../../lib/format.js";
import { api } from "../../lib/api.js";

export function PhotoUploadForm({ onUploaded }) {
  const [date, setDate] = useState(todayDateInputValue());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("date", date);
      if (notes) formData.append("notes", notes);
      const created = await api.uploadProgressPhoto(formData);
      onUploaded(created);
      fileRef.current.value = "";
      setNotes("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <SectionHeading icon={Upload}>Nueva foto</SectionHeading>
      <form onSubmit={submit} className="space-y-2.5">
        <input ref={fileRef} type="file" accept="image/*" className={inputClass()} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Fecha</FieldLabel>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass()} />
          </div>
          <div>
            <FieldLabel>Notas (opcional)</FieldLabel>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass()} placeholder="Ej. Semana 4" />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Subir foto
        </button>
      </form>
    </Card>
  );
}
