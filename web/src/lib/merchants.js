// Tipo de comercio: DÓNDE compraste (la categoría dice PARA QUÉ). Separarlos permite comparar,
// por ejemplo, el kiosco contra el súper o todo lo que comés afuera, sea Comida u Ocio.
import { guessCategory } from "./expenseCategories.js";

export const MERCHANT_TYPES = [
  { id: "supermercado", label: "Súper", icon: "ShoppingCart", hint: "Carrefour, Coto, Día, Jumbo, mayoristas" },
  { id: "kiosco", label: "Kiosco", icon: "Candy", hint: "Kioscos, maxikioscos, polirrubros" },
  { id: "almacen", label: "Almacén / chino", icon: "Store", hint: "Almacén de barrio, autoservicio, chino, dietética" },
  { id: "fresco", label: "Verdulería / carnicería", icon: "Apple", hint: "Verdulería, carnicería, pollería, panadería, fiambrería" },
  { id: "afuera", label: "Comer afuera", icon: "UtensilsCrossed", hint: "Restaurantes, bares, fast food, cafés, heladerías" },
  { id: "delivery", label: "Delivery", icon: "Bike", hint: "Rappi, PedidosYa, pedidos a domicilio" },
  { id: "farmacia", label: "Farmacia / perfumería", icon: "Pill", hint: "Farmacias, perfumerías" },
  { id: "online", label: "Online", icon: "Globe", hint: "Mercado Libre, tiendas web, apps" },
  { id: "otro", label: "Otro", icon: "Store", hint: "Servicios, transporte y todo lo demás" },
];

export function merchantTypeLabel(id) {
  return MERCHANT_TYPES.find((m) => m.id === id)?.label ?? "Sin indicar";
}

// `any` se busca en título y descripción; `titleOnly` solo en el título (palabras que en una
// descripción suelen significar otra cosa, como "día" o "disco").
const MERCHANT_KEYWORDS = [
  { id: "delivery", any: /rappi|pedidos ?ya|delivery|uber ?eats/i },
  { id: "kiosco", any: /kiosc|kiosk|polirrubro|drugstore/i },
  {
    id: "afuera",
    any: /mc ?donald|mostaza|burger|kfc|subway|wendy|pizza|resto\b|restaurant|parrilla|bodeg[oó]n|sushi|cafeter|starbucks|havanna|cervecer|lomiter|empanader|helader|grido|freddo/i,
    titleOnly: /\bbar\b|\bbk\b|\bcaf[eé]\b/i,
  },
  {
    id: "supermercado",
    any: /carrefour|\bcoto\b|jumbo|changom[aá]s|walmart|an[oó]nima|makro|maxiconsumo|diarco|yaguar|hipermercado|mayorista|\bs[uú]per(mercado)?\b/i,
    titleOnly: /\bd[ií]a\b|\bdisco\b|\bvea\b|\bvital\b/i,
  },
  { id: "fresco", any: /verduler|verdura|fruter|carnicer|poller|panader|fiambrer|granja|pescader/i },
  { id: "almacen", any: /almac[eé]n|autoservicio|\bchinos?\b|minimercado|diet[eé]tica|despensa/i },
  { id: "farmacia", any: /farmac|perfumer/i },
  { id: "online", any: /mercado ?libre|\bmeli\b|amazon|shein|temu|aliexpress|online/i },
];

// Productos típicos de kiosco: si el gasto es chico y solo nombra esto, probablemente fue en un kiosco.
const KIOSK_ITEMS = /alfajor|gomita|chicle|caramelo|chocolate|golosina|red ?bull|monster|speed|takis|doritos|lays|papas fritas|\bcocas?\b|gaseosa|sprite|fanta|pepsi|cigarr|pucho|turr[oó]n|bon ?o ?bon|rasta|fajita|pritty|man[ií]\b|chupet[ií]n/i;
const KIOSK_MAX_AMOUNT = 20000;

/** Adivina el tipo de comercio por palabras clave. `amount` (en pesos) habilita la pista de "productos de kiosco". */
export function guessMerchantType(title = "", description = "", amount = null) {
  const desc = description || "";
  for (const k of MERCHANT_KEYWORDS) {
    if (k.any.test(title) || k.titleOnly?.test(title)) return k.id;
  }
  for (const k of MERCHANT_KEYWORDS) {
    if (k.any.test(desc)) return k.id;
  }
  if (amount != null && amount <= KIOSK_MAX_AMOUNT && KIOSK_ITEMS.test(`${title} ${desc}`)) return "kiosco";
  return null;
}

/** "Kiosco  de Abajo!" → "kiosco de abajo": la clave con la que se agrupan y recuerdan los comercios. */
export function normalizeTitle(s = "") {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mostFrequent(counts) {
  let best = null;
  for (const [value, n] of counts) if (!best || n > best[1]) best = [value, n];
  return best?.[0] ?? null;
}

/**
 * Lo que ya cargaste enseña: para cada título, la categoría y el comercio que más usaste.
 * Así, después de marcar "Super13" como Kiosco una vez, la próxima se sugiere sola.
 * @returns {Map<string, {category: string|null, merchantType: string|null}>}
 */
export function learnFromHistory(expenses = []) {
  const byTitle = new Map();
  for (const e of expenses) {
    const key = normalizeTitle(e.title);
    if (!key) continue;
    if (!byTitle.has(key)) byTitle.set(key, { category: new Map(), merchantType: new Map() });
    const entry = byTitle.get(key);
    if (e.category) entry.category.set(e.category, (entry.category.get(e.category) || 0) + 1);
    if (e.merchantType) entry.merchantType.set(e.merchantType, (entry.merchantType.get(e.merchantType) || 0) + 1);
  }
  const memory = new Map();
  for (const [key, entry] of byTitle) {
    memory.set(key, { category: mostFrequent(entry.category), merchantType: mostFrequent(entry.merchantType) });
  }
  return memory;
}

/** Sugerencia de categoría y comercio para un gasto que se está cargando: primero tu historial, después palabras clave. */
export function suggestFor(title, description, memory, amount = null) {
  if (!title?.trim()) return { category: null, merchantType: null };
  const learned = memory?.get(normalizeTitle(title));
  return {
    category: learned?.category ?? guessCategory(title) ?? guessCategory(description || ""),
    merchantType: learned?.merchantType ?? guessMerchantType(title, description, amount),
  };
}

/** El comercio de un gasto ya guardado: el que elegiste o, si no hay, el que se deduce. */
export function effectiveMerchantType(expense, memory = null) {
  if (expense.merchantType) return { id: expense.merchantType, inferred: false };
  const learned = memory?.get(normalizeTitle(expense.title))?.merchantType;
  const id = learned ?? guessMerchantType(expense.title, expense.description, expense.amount);
  return { id, inferred: !!id };
}
