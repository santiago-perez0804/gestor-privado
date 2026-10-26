// Criterios para cargar y clasificar gastos. Una sola fuente para los ⓘ del formulario,
// la guía de Tips y la metodología del informe mensual.
import { guessCategory, categoryLabel } from "./expenseCategories.js";

export const FIELD_TIPS = {
  title: {
    title: "Título: dónde compraste",
    lines: [
      "Poné el comercio o lugar: “Carrefour”, “Kiosco de abajo”, “McDonalds”, “Uber”.",
      "Usá siempre el mismo nombre para el mismo lugar: la app aprende su categoría y su tipo de comercio, y el informe mensual lo agrupa.",
      "Si no sabés el nombre, describilo: “Kiosco esquina facu”, “Chino de la cuadra”.",
    ],
  },
  description: {
    title: "Descripción: qué compraste",
    lines: [
      "Listá los productos separados por coma: “coca 500, alfajor, chicles”.",
      "En salidas, con quién o el motivo: “cumple de Javo”, “aniversario”.",
      "Si dividiste la cuenta, aclaralo: “total $40.000 entre 4”.",
      "Con esto el informe cuenta qué productos repetís (por ejemplo, cuántas cocas compraste en el kiosco).",
    ],
  },
  category: {
    title: "Categoría: para qué fue",
    lines: [
      "Comida: lo que comés en el día a día (súper, verdulería, kiosco).",
      "Ocio: salidas, planes y antojos (bar, restaurante con amigos, cine).",
      "Hogar: limpieza y la casa (detergente, servilletas, alquiler).",
      "McDonalds: si reemplaza una comida que ibas a hacer igual → Comida; si es salida o antojo → Ocio.",
      "Súper con comida y limpieza: si la limpieza pesa, usá “Dividir ticket”.",
    ],
  },
  merchant: {
    title: "Comercio: qué tipo de lugar",
    lines: [
      "Se completa solo según el título (y aprende de lo que ya cargaste). Si se equivoca, cambialo y la próxima vez lo recuerda.",
      "Sirve para comparar kiosco vs súper o cuánto comés afuera, sea Comida u Ocio.",
      "Para servicios, transporte o cosas sin comercio, dejalo en Otro.",
    ],
  },
};

export const CATEGORY_GUIDE = [
  {
    id: "comida",
    rule: "Alimentos y bebidas del día a día.",
    includes: "Súper, verdulería, carnicería, panadería, almacén y kiosco (gaseosas, snacks, golosinas). También comer afuera cuando reemplaza una comida que ibas a hacer igual (almuerzo apurado, vianda).",
    excludes: "Salidas o antojos en restaurantes y bares → Ocio. Productos de limpieza → Hogar.",
  },
  {
    id: "ocio",
    rule: "Salidas, planes y gustos.",
    includes: "Restaurantes y fast food como salida, bares, birras, boliche, cine, recitales, juegos, eventos.",
    excludes: "El viaje para ir → Transporte. Regalos para otros → Otros.",
  },
  {
    id: "hogar",
    rule: "Lo que mantiene la casa.",
    includes: "Limpieza (detergente, lavandina, servilletas, papel higiénico, bolsas), bazar, ferretería, muebles, alquiler, expensas.",
    excludes: "La comida del mismo ticket → Comida (dividí el ticket si es mixto).",
  },
  {
    id: "salud",
    rule: "Cuerpo y cuidado personal.",
    includes: "Farmacia, médico, dentista, prepaga, análisis, peluquería, higiene personal (shampoo, desodorante, pasta dental), gimnasio.",
    excludes: "Limpieza de la casa → Hogar.",
  },
  {
    id: "transporte",
    rule: "Moverte de un lado a otro.",
    includes: "Uber, taxi, SUBE, colectivo, nafta, peajes, estacionamiento.",
    excludes: "Lo que comprás en el camino o en el destino (comida, birras) → Comida u Ocio.",
  },
  {
    id: "servicios",
    rule: "Cuentas y suscripciones.",
    includes: "Luz, gas, agua, internet, celular y datos, Netflix, Spotify, Google One, seguros.",
    excludes: "Compras sueltas en apps (juegos, tiendas) → Ocio u Otros.",
  },
  {
    id: "indumentaria",
    rule: "Ropa y accesorios.",
    includes: "Ropa, zapatillas, calzado, accesorios, arreglos de ropa.",
    excludes: "Ropa para regalar → Otros.",
  },
  {
    id: "otros",
    rule: "Lo que no entra en ninguna otra.",
    includes: "Regalos para otros, trámites, donaciones, comisiones.",
    excludes: "No lo uses para comida ni para “no me acuerdo”: elegí la categoría más probable.",
  },
];

export const SPECIAL_CASES = [
  {
    id: "fastfood",
    title: "¿McDonalds, pizza o empanadas: Comida u Ocio?",
    body: "Preguntate: ¿lo hubiera comido igual en casa? Si reemplaza una comida (almuerzo entre clases, cena porque no llegaste a cocinar) → Comida. Si es salida, plan con amigos o antojo → Ocio. En los dos casos poné Comercio = Comer afuera: el informe suma aparte todo lo que comés afuera.",
  },
  {
    id: "mixed",
    title: "Súper con comida y limpieza en el mismo ticket",
    body: "Si la parte de limpieza u hogar pesa (más o menos el 20% del ticket o más de $5.000), usá “Dividir ticket” y cargá las dos partes. Si es poquito (unas servilletas), dejalo todo en Comida: gana la categoría del mayor monto.",
  },
  {
    id: "kiosk",
    title: "Compras en el kiosco",
    body: "Van en Comida (u Ocio si son para una salida) con Comercio = Kiosco. En la descripción poné qué llevaste: así el informe compara cuánto te sale el kiosco contra el súper y qué productos repetís.",
  },
  {
    id: "shared",
    title: "Gastos compartidos",
    body: "Cargá solo lo que te toca a vos y aclaralo en la descripción (“total $82.000, 50/50”). Si pagaste todo y te lo tienen que devolver, anotá lo que te deben en Deudas.",
  },
  {
    id: "unknown",
    title: "“No me acuerdo qué era”",
    body: "Poné tu mejor estimación de categoría y en la descripción “no me acuerdo”. Una categoría aproximada sirve más que “Otros”: si no, el análisis pierde esa plata.",
  },
  {
    id: "gifts",
    title: "Regalos",
    body: "Regalos para otros → Otros (en la descripción, para quién y qué). Si invitaste una salida → Ocio.",
  },
];

const FAST_FOOD = /mc ?donald|mostaza|burger|kfc|subway|wendy|pizza|empanad|lomit|hamburgues|sushi|resto\b|restaurant|parrilla|rappi|pedidos ?ya/i;
const HOME_ITEMS = /detergente|lavandina|servilleta|papel higi|rollo de cocina|esponja|jab[oó]n en polvo|suavizante|bolsas? de residuo|limpiador|insecticida|trapo|virul|desodorante de ambiente/i;
const FOOD_ITEMS = /leche|yogur|pan\b|fideo|arroz|huevo|carne|pollo|queso|jam[oó]n|verdura|fruta|galletit|coca|gaseosa|alfajor|cerveza|birra/i;

/**
 * Aviso según lo que se está cargando: dudas típicas de clasificación.
 * @returns {{ text: string, action?: "split" } | null}
 */
export function classificationHint({ title = "", description = "", category = "", merchantType = "" }) {
  const text = `${title} ${description || ""}`;
  if (!title.trim()) return null;
  if (category === "transporte" && FOOD_ITEMS.test(text))
    return { text: "Transporte es solo el viaje: lo que compraste en el camino va en Comida u Ocio." };
  if ((merchantType === "afuera" || merchantType === "delivery" || FAST_FOOD.test(text)) && category !== "comida" && category !== "ocio")
    return { text: "¿Comida u Ocio? Si reemplaza una comida que ibas a hacer igual → Comida; si es salida, plan o antojo → Ocio." };
  if ((merchantType === "afuera" || merchantType === "delivery" || FAST_FOOD.test(text)) && !description?.trim())
    return { text: "Comida si reemplaza una comida que ibas a hacer igual, Ocio si es salida o antojo. En la descripción podés anotar con quién o por qué." };
  if (category !== "hogar" && HOME_ITEMS.test(description || ""))
    return { text: "Hay productos de limpieza u hogar: si pesan en el ticket, dividilo en Comida + Hogar.", action: "split" };
  if (category === "hogar" && FOOD_ITEMS.test(description || ""))
    return { text: "Hay comida en este ticket: si es una parte grande, dividilo en Hogar + Comida.", action: "split" };
  if (category === "otros") {
    const guess = guessCategory(text);
    if (guess && guess !== "otros") return { text: `Parece ${categoryLabel(guess)}: “Otros” es solo para lo que no entra en ninguna categoría.` };
  }
  if (merchantType === "kiosco" && !description?.trim())
    return { text: "Anotá qué llevaste del kiosco (ej. “coca, alfajor”): el informe lo usa para ver qué repetís." };
  return null;
}

/** Categorías que se confunden con razón (las reglas de arriba deciden): no se marcan como sospechosas. */
const AMBIGUOUS_PAIRS = new Set(["comida|ocio", "comida|hogar", "hogar|salud"]);

/** ¿La categoría elegida choca con lo que dice el texto? Devuelve la categoría probable o null. */
export function suspiciousCategory(expense) {
  if (!expense.category) return null;
  // El título manda: "Hospital · le pagué por mercadopago" es Salud aunque la descripción diga "mercado".
  const guess = guessCategory(expense.title) ?? guessCategory(expense.description || "");
  if (!guess || guess === expense.category) return null;
  const pair = [guess, expense.category].sort().join("|");
  return AMBIGUOUS_PAIRS.has(pair) ? null : guess;
}
