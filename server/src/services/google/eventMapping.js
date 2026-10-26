// Salida ⇄ evento de Google Calendar.
// - Lo que Google entiende va en los campos del evento (título, lugar, fecha/hora, notas, y el
//   estado tentativo/confirmado en `status`).
// - Lo propio de la app (categoría, con quién, si fuiste o no) va en extendedProperties.private.
import { guessOutingCategory, OUTING_CATEGORIES, OUTING_STATUSES } from "../../lib/ocio/constants.js";

export const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DEFAULT_DURATION_MIN = 120;
const pad = (n) => String(n).padStart(2, "0");

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMinutes(date, time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return { date: addDays(date, dayShift), time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}` };
}

/** Un instante (dateTime de Google, con offset) → fecha y hora en Buenos Aires. */
export function toLocalParts(dateTime) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(dateTime))
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}` };
}

/** Salida → cuerpo de evento para la API de Calendar. */
export function outingToEvent(o) {
  const timed = !o.allDay && o.startTime;
  const end = timed ? (o.endTime ? { date: o.endTime > o.startTime ? o.date : addDays(o.date, 1), time: o.endTime } : addMinutes(o.date, o.startTime, DEFAULT_DURATION_MIN)) : null;
  return {
    summary: o.title,
    location: o.place || undefined,
    description: o.notes || undefined,
    start: timed ? { dateTime: `${o.date}T${o.startTime}:00`, timeZone: TIME_ZONE } : { date: o.date },
    end: timed ? { dateTime: `${end.date}T${end.time}:00`, timeZone: TIME_ZONE } : { date: addDays(o.date, 1) },
    status: o.status === "tentative" ? "tentative" : "confirmed",
    extendedProperties: {
      private: {
        outingId: String(o.id),
        category: o.category || "",
        withWhom: o.withWhom || "",
        attendance: o.status,
      },
    },
  };
}

/** Evento de Google → campos de salida (sin id local). */
export function eventToOuting(ev) {
  const priv = ev.extendedProperties?.private || {};
  const timed = !!ev.start?.dateTime;
  const start = timed ? toLocalParts(ev.start.dateTime) : { date: ev.start?.date, time: null };
  const end = timed && ev.end?.dateTime ? toLocalParts(ev.end.dateTime) : null;
  const attendance = OUTING_STATUSES.includes(priv.attendance) ? priv.attendance : null;
  // Si en Google lo pasaron a tentativo/confirmado, eso manda sobre lo que guardamos antes,
  // salvo que la salida ya esté marcada como "fui" / "no fui".
  const fromGoogle = ev.status === "tentative" ? "tentative" : "confirmed";
  const status = attendance === "attended" || attendance === "not_attended" ? attendance : fromGoogle;
  const category = OUTING_CATEGORIES.includes(priv.category) ? priv.category : guessOutingCategory({ title: ev.summary || "" });
  return {
    title: ev.summary || "(sin título)",
    date: start.date,
    startTime: start.time,
    endTime: end && end.date === start.date ? end.time : null,
    allDay: timed ? 0 : 1,
    place: ev.location || null,
    notes: ev.description || null,
    withWhom: priv.withWhom || null,
    category,
    status,
  };
}
