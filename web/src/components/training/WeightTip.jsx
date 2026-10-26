import { Lightbulb } from "lucide-react";

const TIPS = [
  "La mañana es el mejor horario para pesarte, en ayunas y antes de tomar líquidos.",
  "Pesate siempre en las mismas condiciones (misma ropa, mismo momento del día) para que las comparaciones tengan sentido.",
  "El peso corporal varía por agua e intestino de un día a otro — mirá la tendencia de varias semanas, no un solo registro.",
  "Después de una comida abundante o con mucha sal, es normal pesar más por retención de líquido, no por grasa.",
  "Pesarte 1 o 2 veces por semana suele alcanzar para ver una tendencia real sin obsesionarte con el número diario.",
];

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

export function WeightTip() {
  const tip = TIPS[dayOfYear(new Date()) % TIPS.length];
  return (
    <div className="flex items-start gap-2 mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
      <Lightbulb size={13} className="shrink-0 mt-0.5" />
      <p>{tip}</p>
    </div>
  );
}
