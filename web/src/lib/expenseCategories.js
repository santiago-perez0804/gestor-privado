export const EXPENSE_CATEGORIES = [
  { id: "comida", label: "Comida", colorVar: "--chart-cat-1" },
  { id: "transporte", label: "Transporte", colorVar: "--chart-cat-2" },
  { id: "servicios", label: "Servicios", colorVar: "--chart-cat-3" },
  { id: "ocio", label: "Ocio", colorVar: "--chart-cat-4" },
  { id: "salud", label: "Salud", colorVar: "--chart-cat-5" },
  { id: "hogar", label: "Hogar", colorVar: "--chart-cat-6" },
  { id: "indumentaria", label: "Indumentaria", colorVar: "--chart-cat-7" },
  { id: "otros", label: "Otros", colorVar: "--chart-cat-8" },
];

/** Ícono por categoría: el de la fila cuando no elegiste uno ni lo da el título. */
export const CATEGORY_ICONS = {
  comida: "Utensils",
  transporte: "Car",
  servicios: "Zap",
  ocio: "Ticket",
  salud: "HeartPulse",
  hogar: "Home",
  indumentaria: "Shirt",
  otros: "Receipt",
};

export function categoryLabel(id) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || "Otros";
}

export function categoryColorVar(id) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.colorVar || "--chart-cat-8";
}

// Palabras clave para adivinar la categoría a partir del título o la descripción (la primera que coincide gana).
const CATEGORY_KEYWORDS = [
  ["comida", /s[uú]per|mercado(?! ?(pago|libre))|carrefour|jumbo|changom[aá]s|walmart|verdu|carnic|almac|chino|comida|almuerzo|cena|delivery|rappi|pedidosya|caf[eé]|panader|kiosco|alfajor|galletit|yogur|leche|fideo|huevo|pollo|gaseosa|coca\b|golosina|gomita|chocolate|snack/i],
  ["transporte", /uber|cabify|didi|taxi|remis|sube|colectivo|bondi|tren|subte|nafta|combustible|peaje|estacionamiento/i],
  ["servicios", /luz|gas\b|agua|internet|celular|tel[eé]fono|netflix|spotify|disney|hbo|youtube|icloud|seguro/i],
  ["ocio", /cine|bar\b|birra|cerveza|boliche|salida|teatro|recital|juego|steam|libro/i],
  ["salud", /farmacia|m[eé]dic|hospital|cl[ií]nica|dentista|obra social|prepaga|remedio|gimnasio|gym/i],
  ["hogar", /alquiler|expensas|limpieza|ferreter|mueble|hogar|detergente|lavandina|servilleta/i],
  ["indumentaria", /ropa|zapatilla|remera|pantal[oó]n|campera|zapato/i],
];

export function guessCategory(text) {
  return CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}
