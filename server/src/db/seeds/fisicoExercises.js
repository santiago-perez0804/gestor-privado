// Biblioteca semilla de Físico: ejercicios comunes en español con sus músculos.
// "P" = primario (cuenta 1 serie), "S" = secundario (cuenta ½ serie) para el volumen semanal.
// bar: barra por defecto para la calculadora de discos ("olimpica" 20 kg, "z" 10 kg).

const E = (name, equipment, muscles, extra = {}) => ({
  name,
  equipment,
  muscles: muscles.split(" ").map((m) => {
    const [muscle, role] = m.split(":");
    return { muscle, role: role === "P" ? "primary" : "secondary" };
  }),
  bar: extra.bar ?? (equipment === "barra" ? "olimpica" : null),
  isBodyweight: !!extra.bw,
  notes: extra.notes ?? null,
});

export const FISICO_EXERCISES = [
  // Pecho
  E("Press banca plano", "barra", "pecho:P triceps:S hombro_anterior:S"),
  E("Press banca inclinado", "barra", "pecho:P hombro_anterior:S triceps:S"),
  E("Press plano con mancuernas", "mancuernas", "pecho:P triceps:S hombro_anterior:S"),
  E("Press inclinado con mancuernas", "mancuernas", "pecho:P hombro_anterior:S triceps:S"),
  E("Aperturas con mancuernas", "mancuernas", "pecho:P"),
  E("Cruce de poleas", "polea", "pecho:P"),
  E("Aperturas en máquina (peck deck)", "maquina", "pecho:P"),
  E("Press de pecho en máquina", "maquina", "pecho:P triceps:S hombro_anterior:S"),
  E("Fondos en paralelas", "peso_corporal", "pecho:P triceps:S hombro_anterior:S", { bw: true, notes: "El peso es el lastre (0 = sin lastre)." }),
  E("Flexiones de brazos", "peso_corporal", "pecho:P triceps:S hombro_anterior:S", { bw: true }),
  // Espalda
  E("Dominadas lastradas", "peso_corporal", "espalda:P biceps:S", { bw: true, notes: "El peso es el lastre: 0 = dominadas sin lastre." }),
  E("Dominadas supinas", "peso_corporal", "espalda:P biceps:S", { bw: true, notes: "Agarre con las palmas hacia vos." }),
  E("Remo invertido", "peso_corporal", "espalda:P biceps:S deltoide_posterior:S", { bw: true }),
  E("Jalón al pecho", "polea", "espalda:P biceps:S"),
  E("Jalón al pecho, agarre neutro", "polea", "espalda:P biceps:S"),
  E("Remo con barra", "barra", "espalda:P deltoide_posterior:S biceps:S"),
  E("Remo con mancuerna a una mano", "mancuernas", "espalda:P biceps:S deltoide_posterior:S"),
  E("Remo sentado en polea", "polea", "espalda:P biceps:S"),
  E("Remo en máquina", "maquina", "espalda:P biceps:S deltoide_posterior:S"),
  E("Pullover en polea", "polea", "espalda:P"),
  E("Encogimientos con mancuernas", "mancuernas", "espalda:P antebrazo:S", { notes: "Trapecio." }),
  E("Peso muerto", "barra", "gluteo:P isquiotibiales:P espalda:S cuadriceps:S antebrazo:S"),
  // Hombros
  E("Press militar con barra", "barra", "hombro_anterior:P hombro_lateral:S triceps:S"),
  E("Press de hombros con mancuernas", "mancuernas", "hombro_anterior:P hombro_lateral:S triceps:S"),
  E("Press de hombros en máquina", "maquina", "hombro_anterior:P triceps:S"),
  E("Elevaciones laterales con mancuernas", "mancuernas", "hombro_lateral:P"),
  E("Elevaciones laterales en polea", "polea", "hombro_lateral:P"),
  E("Elevaciones laterales en máquina", "maquina", "hombro_lateral:P"),
  E("Elevaciones frontales", "mancuernas", "hombro_anterior:P"),
  E("Face pull", "polea", "deltoide_posterior:P espalda:S", { notes: "Deltoide posterior y manguito rotador." }),
  E("Pájaros con mancuernas", "mancuernas", "deltoide_posterior:P", { notes: "Vuelos posteriores, inclinado hacia adelante." }),
  E("Pájaros en máquina (peck deck inverso)", "maquina", "deltoide_posterior:P"),
  // Bíceps
  E("Curl con barra", "barra", "biceps:P antebrazo:S", { bar: "z" }),
  E("Curl con mancuernas", "mancuernas", "biceps:P antebrazo:S"),
  E("Curl inclinado con mancuernas", "mancuernas", "biceps:P", { notes: "Cabeza larga." }),
  E("Curl martillo", "mancuernas", "biceps:P antebrazo:S", { notes: "Braquial y antebrazo." }),
  E("Curl predicador", "barra", "biceps:P", { bar: "z", notes: "Banco Scott." }),
  E("Curl en polea", "polea", "biceps:P antebrazo:S"),
  E("Curl bayesiano en polea", "polea", "biceps:P", { notes: "De espaldas a la polea: estira la cabeza larga." }),
  E("Curl concentrado", "mancuernas", "biceps:P"),
  // Tríceps
  E("Extensión de tríceps en polea con cuerda", "polea", "triceps:P"),
  E("Extensión de tríceps en polea con barra", "polea", "triceps:P"),
  E("Extensión de tríceps sobre la cabeza en polea", "polea", "triceps:P", { notes: "Cabeza larga." }),
  E("Extensión de tríceps sobre la cabeza con mancuerna", "mancuernas", "triceps:P"),
  E("Press francés", "barra", "triceps:P", { bar: "z" }),
  E("Press banca agarre cerrado", "barra", "triceps:P pecho:S hombro_anterior:S"),
  E("Fondos entre bancos", "peso_corporal", "triceps:P pecho:S", { bw: true }),
  // Piernas
  E("Sentadilla", "barra", "cuadriceps:P gluteo:S"),
  E("Sentadilla frontal", "barra", "cuadriceps:P gluteo:S abdomen:S"),
  E("Prensa de piernas", "maquina", "cuadriceps:P gluteo:S"),
  E("Hack squat", "maquina", "cuadriceps:P gluteo:S"),
  E("Sentadilla búlgara", "mancuernas", "cuadriceps:P gluteo:P"),
  E("Zancadas con mancuernas", "mancuernas", "cuadriceps:P gluteo:S"),
  E("Extensión de cuádriceps", "maquina", "cuadriceps:P"),
  E("Peso muerto rumano", "barra", "isquiotibiales:P gluteo:S espalda:S"),
  E("Curl femoral acostado", "maquina", "isquiotibiales:P"),
  E("Curl femoral sentado", "maquina", "isquiotibiales:P"),
  E("Hip thrust", "barra", "gluteo:P isquiotibiales:S"),
  E("Elevación de gemelos de pie", "maquina", "gemelos:P"),
  E("Elevación de gemelos sentado", "maquina", "gemelos:P"),
  // Abdomen y antebrazo
  E("Crunch en polea", "polea", "abdomen:P"),
  E("Elevaciones de piernas colgado", "peso_corporal", "abdomen:P", { bw: true }),
  E("Rueda abdominal", "otro", "abdomen:P"),
  E("Curl de muñeca", "mancuernas", "antebrazo:P"),
];

// Cardio: el tiempo va siempre; "fields" son los datos opcionales que pide cada uno (distance = km,
// level = nivel/velocidad/inclinación con su etiqueta, count = saltos/pisos/pasos). Sin músculos:
// el cardio no suma series al volumen semanal.
const C = (name, equipment, fields, { level = null, count = null, notes = null } = {}) => ({ name, equipment, fields, levelLabel: level, countLabel: count, notes });

export const FISICO_CARDIO = [
  C("Saltar la cuerda", "otro", ["count"], { count: "saltos", notes: "Podés hacerlo en bloques (por ejemplo 5 × 2 min)." }),
  C("Caminadora", "maquina", ["distance", "level"], { level: "inclinación" }),
  C("Escaladora (escalera mecánica)", "maquina", ["count", "level"], { level: "nivel", count: "pisos" }),
  C("Bicicleta fija", "maquina", ["level", "distance"], { level: "nivel" }),
  C("Elíptico", "maquina", ["level", "distance"], { level: "nivel" }),
  C("Remo ergómetro", "maquina", ["distance", "level"], { level: "resistencia" }),
  C("Correr", "otro", ["distance"]),
  C("Caminata", "otro", ["distance", "count"], { count: "pasos" }),
  C("Bici", "otro", ["distance"]),
  C("Natación", "otro", ["distance"]),
  C("Burpees", "peso_corporal", ["count"], { count: "burpees" }),
];
