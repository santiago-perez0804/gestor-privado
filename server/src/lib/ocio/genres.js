// Géneros propios en español. Todo lo que llega de un catálogo (TMDB, Open Library, Google Books,
// RAWG) o se escribe a mano se traduce a estos ids, para que las estadísticas no mezclen
// "Science Fiction", "Sci-Fi & Fantasy" y "Ciencia ficción".

/** id → etiqueta. El orden es el de los selectores. */
export const GENRES = {
  accion: "Acción",
  aventura: "Aventura",
  animacion: "Animación",
  biografia: "Biografía",
  belico: "Bélico",
  ciencia_ficcion: "Ciencia ficción",
  clasico: "Clásico",
  comedia: "Comedia",
  crimen: "Policial",
  distopia: "Distopía",
  documental: "Documental",
  drama: "Drama",
  ensayo: "Ensayo",
  familiar: "Familiar",
  fantasia: "Fantasía",
  ficcion_literaria: "Ficción literaria",
  filosofia: "Filosofía",
  historia: "Historia",
  infantil: "Infantil",
  juvenil: "Juvenil",
  misterio: "Misterio",
  mitologia: "Mitología",
  musical: "Musical",
  novela_grafica: "Novela gráfica",
  poesia: "Poesía",
  politica: "Política",
  romance: "Romance",
  terror: "Terror",
  thriller: "Thriller",
  western: "Western",
  // videojuegos
  rpg: "Rol (RPG)",
  estrategia: "Estrategia",
  plataformas: "Plataformas",
  shooter: "Shooter",
  puzzle: "Puzzle",
  simulacion: "Simulación",
  deportes: "Deportes",
  carreras: "Carreras",
  lucha: "Lucha",
  indie: "Indie",
  mundo_abierto: "Mundo abierto",
  multijugador: "Multijugador",
  casual: "Casual",
  arcade: "Arcade",
  cartas: "Cartas y tablero",
};

const strip = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();

// Palabras clave (sin tildes, en minúscula) → ids. Un nombre puede dar más de un género
// ("Sci-Fi & Fantasy" → ciencia ficción + fantasía).
const RULES = [
  [/sci fi|science fiction|ciencia ficcion|scifi|cyberpunk|space opera/, ["ciencia_ficcion"]],
  [/fantas/, ["fantasia"]],
  [/dystop|distop|totalitarian/, ["distopia"]],
  [/action & adventure/, ["accion", "aventura"]],
  [/war & politics/, ["belico", "politica"]],
  [/\baction\b|\baccion\b/, ["accion"]],
  [/adventure|aventura/, ["aventura"]],
  [/animat|animacion|anime/, ["animacion"]],
  [/biograph|biografia|memoir|autobiograf/, ["biografia"]],
  [/\bwar\b|belic|guerra/, ["belico"]],
  [/classic|clasico/, ["clasico"]],
  [/comed|humor/, ["comedia"]],
  [/crime|crimen|policial|detective|noir/, ["crimen"]],
  [/documentar/, ["documental"]],
  [/drama/, ["drama"]],
  [/essay|ensayo/, ["ensayo"]],
  [/family|familia/, ["familiar"]],
  [/literary fiction|ficcion literaria|literatura contemporanea/, ["ficcion_literaria"]],
  [/philosoph|filosof/, ["filosofia"]],
  [/histor/, ["historia"]],
  [/children|kids|infantil/, ["infantil"]],
  [/young adult|juvenil/, ["juvenil"]],
  [/myster|misterio/, ["misterio"]],
  [/mytholog|mitolog|epic poetry|homer/, ["mitologia"]],
  [/music/, ["musical"]],
  [/comic|graphic novel|novela grafica|manga/, ["novela_grafica"]],
  [/poe(try|sia|m)/, ["poesia"]],
  [/politic/, ["politica"]],
  [/romanc|romant|love stor/, ["romance"]],
  [/horror|terror/, ["terror"]],
  [/thriller|suspens/, ["thriller"]],
  [/western/, ["western"]],
  [/\brpg\b|role playing|\brol\b/, ["rpg"]],
  [/strateg|estrategia/, ["estrategia"]],
  [/platform/, ["plataformas"]],
  [/shooter|disparos/, ["shooter"]],
  [/puzzle/, ["puzzle"]],
  [/simulat|simulacion/, ["simulacion"]],
  [/\bsports?\b|deporte/, ["deportes"]],
  [/racing|carreras/, ["carreras"]],
  [/fighting|lucha/, ["lucha"]],
  [/\bindie\b/, ["indie"]],
  [/open world|mundo abierto/, ["mundo_abierto"]],
  [/multiplayer|multijugador/, ["multijugador"]],
  [/casual/, ["casual"]],
  [/arcade/, ["arcade"]],
  [/board game|\bcards?\b|cartas|tablero/, ["cartas"]],
];

/** Un nombre de género cualquiera → ids propios (vacío si no se reconoce). */
export function mapGenre(name) {
  const text = strip(name);
  if (!text) return [];
  if (GENRES[text.replace(/ /g, "_")]) return [text.replace(/ /g, "_")];
  const out = [];
  for (const [re, ids] of RULES) if (re.test(text)) for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

/** Lista de nombres (de una fuente o a mano) → ids propios, sin repetir, hasta `limit`. */
export function mapGenres(names = [], limit = 4) {
  const out = [];
  for (const n of names) for (const id of mapGenre(n)) if (!out.includes(id)) out.push(id);
  return out.slice(0, limit);
}
