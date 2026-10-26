import * as LucideIcons from "lucide-react";

export function getIconComponent(name, fallback = "Circle") {
  return LucideIcons[name] || LucideIcons[fallback] || LucideIcons.Circle;
}

export const EXPENSE_ICONS = [
  "ShoppingCart", "Zap", "Droplet", "Flame", "Wallet", "CreditCard", "Receipt",
  "Home", "Car", "Fuel", "Bus", "Plane", "Utensils", "Coffee", "Smartphone",
  "Wifi", "Tv", "Film", "Music", "Gift", "Shirt", "PawPrint", "Stethoscope", "GraduationCap",
];

export const PLAN_ROUTINE_ICONS = [
  "Dumbbell", "Flame", "Zap", "Target", "TrendingUp", "Activity", "Heart", "Timer",
  "Repeat", "Footprints", "PersonStanding", "Bike", "Trophy", "Flag", "CalendarDays",
  "ListChecks", "Swords", "Mountain",
];

const EXPENSE_KEYWORDS = [
  [/regalo/i, "Gift"],
  [/kiosc/i, "Candy"],
  [/mc ?donald|mostaza|burger|pizza|resto\b|restaurant|parrilla|sushi/i, "UtensilsCrossed"],
  [/uala|transfer|billetera|banco/i, "Wallet"],
  [/super|coto|dia|carrefour|jumbo|verduler|almac/i, "ShoppingCart"],
  [/luz|edenor|edesur|gas\b|agua|servicio/i, "Zap"],
  [/netflix|spotify|disney|hbo|prime|suscrip/i, "Music"],
  [/nafta|combustible|ypf|shell|auto|uber|cabify/i, "Car"],
  [/farmacia|medic|doctor|salud/i, "Stethoscope"],
  [/curso|facultad|universidad|libro/i, "GraduationCap"],
  [/ropa|zapatilla|indumentaria/i, "Shirt"],
  [/celular|telefono|movistar|personal|claro/i, "Smartphone"],
  [/alquiler|expensa|hogar/i, "Home"],
];

export function pickExpenseIcon(title = "") {
  for (const [pattern, icon] of EXPENSE_KEYWORDS) {
    if (pattern.test(title)) return icon;
  }
  return "Receipt";
}

const LEG_MUSCLES = new Set(["quadriceps", "hamstrings", "calves", "glutes", "abductors", "adductors"]);
const CORE_MUSCLES = new Set(["abdominals", "lower back"]);

export function pickExerciseIcon(primaryMuscles = []) {
  if (primaryMuscles.some((m) => LEG_MUSCLES.has(m))) return "Footprints";
  if (primaryMuscles.some((m) => CORE_MUSCLES.has(m))) return "Zap";
  return "Dumbbell";
}

export const MEASUREMENT_TYPE_ICONS = {
  cintura: "Ruler",
  brazo: "Dumbbell",
  pecho: "Heart",
  muslo: "Footprints",
  cuello: "Circle",
  cadera: "Ruler",
};

export const MEASUREMENT_TYPE_LABELS = {
  cintura: "Cintura",
  brazo: "Brazo",
  pecho: "Pecho",
  muslo: "Muslo",
  cuello: "Cuello",
  cadera: "Cadera",
};

export const MEDIA_TYPE_ICONS = {
  pelicula: "Clapperboard",
  serie: "Tv",
  libro: "BookOpen",
  videojuego: "Gamepad2",
};

export const MEDIA_TYPE_LABELS = {
  pelicula: "Película",
  serie: "Serie",
  libro: "Libro",
  videojuego: "Videojuego",
};

export const MEDIA_TYPE_DEFAULTS = {
  pelicula: { progressLabel: "min" },
  serie: { progressLabel: "cap." },
  libro: { progressLabel: "pág." },
  videojuego: { progressLabel: "hs" },
};

export const MEDIA_STATUS_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completado: "Completado",
  abandonado: "Abandonado",
};

export const OUTING_ICON = "MapPin";

export const OUTING_STATUS_LABELS = {
  planeado: "Planeado",
  hecho: "Hecho",
  cancelado: "Cancelado",
};

export const OCIO_ICONS = [
  "Clapperboard", "Tv", "BookOpen", "Gamepad2", "MapPin", "Popcorn", "Music",
  "Palette", "Camera", "Ticket", "Mountain", "Bike", "PartyPopper", "Headphones",
  "Dices", "Trophy",
];

export const PROJECT_ICONS = [
  "Instagram", "BookOpen", "Library", "BookMarked", "Camera", "Megaphone", "PenLine", "Sparkles",
  "Rocket", "Lightbulb", "Globe", "Code", "Palette", "Mic", "Video", "Users", "Heart", "Star",
];
