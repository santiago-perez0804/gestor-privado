import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOuting } from "../src/lib/ocio/parseOuting.js";

// Lunes 26 de octubre de 2026.
const TODAY = "2026-10-26";
const p = (text) => parseOuting(text, TODAY);

test("frase completa: qué, dónde, día de la semana + número y hora", () => {
  assert.deepEqual(p("recital en Quality el sábado 14 a las 21"), {
    title: "Recital",
    date: "2026-11-14",
    startTime: "21:00",
    place: "Quality",
    withWhom: null,
    category: "musica",
    warnings: [],
  });
});

test("días relativos y de la semana", () => {
  assert.equal(p("asado mañana").date, "2026-10-27");
  assert.equal(p("cine pasado mañana").date, "2026-10-28");
  assert.equal(p("birras hoy").date, "2026-10-26");
  assert.equal(p("fiesta el sábado").date, "2026-10-31");
  assert.equal(p("padel el lunes").date, "2026-10-26", "hoy es lunes: cuenta hoy");
  assert.equal(p("padel el próximo lunes").date, "2026-11-02");
  assert.equal(p("algo este finde").date, "2026-10-31");
});

test("fechas con número", () => {
  assert.equal(p("cumple de Fede el 7/11").date, "2026-11-07");
  assert.equal(p("viaje el 3 de enero").date, "2027-01-03", "enero ya pasó este año: el que viene");
  assert.equal(p("muestra el 30").date, "2026-10-30");
  assert.equal(p("muestra el 2").date, "2026-11-02", "el 2 de octubre ya pasó");
  assert.equal(p("teatro 15/12/2026").date, "2026-12-15");
});

test("horas en sus formas habituales", () => {
  assert.equal(p("cena a las 21:30").startTime, "21:30");
  assert.equal(p("cena 21hs").startTime, "21:00");
  assert.equal(p("cena a las 9 de la noche").startTime, "21:00");
  assert.equal(p("brunch a las 11").startTime, "11:00");
  assert.equal(p("brunch").startTime, null);
});

test("con quién, lugar con mayúsculas y categoría", () => {
  const r = p("asado con Marto y Javo en lo de Pampa el sábado");
  assert.equal(r.withWhom, "Marto y Javo");
  assert.equal(r.place, "lo de Pampa");
  assert.equal(r.title, "Asado");
  assert.equal(r.category, "comida");
  assert.equal(p("Cumpleaños de Fede el 7/11").category, "celebracion");
});

test("avisa si el número no coincide con el día de la semana", () => {
  const r = p("recital el viernes 14");
  // El próximo viernes 14 es en mayo de 2027: lo usa, pero queda lejos.
  assert.equal(r.date, "2027-05-14");
  assert.match(r.warnings[0], /2027-05-14/);
  const odd = p("recital el lunes 31");
  assert.ok(odd.date);
});

test("sin fecha: no inventa una", () => {
  const r = p("ver a Kiara");
  assert.equal(r.date, null);
  assert.equal(r.title, "Ver a Kiara");
});
