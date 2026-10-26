import { test } from "node:test";
import assert from "node:assert/strict";
import { guessMerchantType, learnFromHistory, suggestFor, normalizeTitle } from "../src/lib/merchants.js";
import { extractItems } from "../src/lib/monthlyReport.js";
import { getBillingMonth, parseBillingMonthKey, billingMonthKey } from "../src/lib/billing.js";

test("guessMerchantType reconoce comercios por título y descripción", () => {
  assert.equal(guessMerchantType("Carrefour"), "supermercado");
  assert.equal(guessMerchantType("muchas compras supermercado"), "supermercado");
  assert.equal(guessMerchantType("Super13"), null, "Super13 no es un súper (no hay límite de palabra)");
  assert.equal(guessMerchantType("McDonalds"), "afuera");
  assert.equal(guessMerchantType("Coca y fajitas", "En el kiosco de abajo"), "kiosco");
  assert.equal(guessMerchantType("gomitas y redbull", "", 7300), "kiosco", "productos de kiosco y monto chico");
  assert.equal(guessMerchantType("gomitas y redbull", "", 90000), null, "un monto grande no es kiosco");
  assert.equal(guessMerchantType("Buenos Dias"), null, "'Dias' no es el súper Día");
});

test("el historial enseña: el mismo título sugiere el comercio que ya elegiste", () => {
  const memory = learnFromHistory([
    { title: "Super13", category: "comida", merchantType: "kiosco" },
    { title: "super13 ", category: "comida", merchantType: "kiosco" },
  ]);
  assert.deepEqual(suggestFor("SUPER13", "", memory), { category: "comida", merchantType: "kiosco" });
  assert.equal(normalizeTitle("Kiosco  de Abajo!"), "kiosco de abajo");
});

test("extractItems separa productos y los pasa a singular", () => {
  assert.deepEqual(extractItems("2 cebollas, 200gr jamon, 125gr aprox queso rayado"), ["cebolla", "jamon", "queso rayado"]);
  assert.deepEqual(extractItems("Dulce de leche y postres danette"), ["dulce de leche", "postre danette"]);
  assert.deepEqual(extractItems("En el kiosco de abajo"), [], "nombres de comercio no son productos");
});

test("período de tarjeta: después del cierre la compra pasa al mes siguiente", () => {
  assert.deepEqual(getBillingMonth("2026-10-26", 26), { year: 2026, month: 9 });
  assert.deepEqual(getBillingMonth("2026-10-27", 26), { year: 2026, month: 10 });
  assert.deepEqual(getBillingMonth("2026-12-30", 26), { year: 2027, month: 0 });
  assert.deepEqual(parseBillingMonthKey(billingMonthKey({ year: 2026, month: 9 })), { year: 2026, month: 9 });
  assert.equal(parseBillingMonthKey("basura"), null);
});
