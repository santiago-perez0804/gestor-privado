import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sharedSchema } from "../src/db/schema/shared.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { sniffImage, imageSize, validateImage, nextInventoryCode, easelSequence, easelSettings, dailyIndex } from "../src/lib/ocio/images.js";
import { createGallery } from "../src/services/ocio/gallery.js";

const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const GIF_1x1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
// JPEG mínimo: SOI, un APP0 y el SOF0 con alto 32 y ancho 64.
const JPEG_64x32 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x40, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);

test("reconoce PNG, JPG y GIF por su contenido y lee las medidas", () => {
  assert.deepEqual(sniffImage(PNG_1x1), { mime: "image/png", ext: "png" });
  assert.deepEqual(sniffImage(GIF_1x1), { mime: "image/gif", ext: "gif" });
  assert.deepEqual(sniffImage(JPEG_64x32), { mime: "image/jpeg", ext: "jpg" });
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), null, "SVG no (puede traer scripts)");
  assert.deepEqual(imageSize(PNG_1x1, "image/png"), { width: 1, height: 1 });
  assert.deepEqual(imageSize(GIF_1x1, "image/gif"), { width: 1, height: 1 });
  assert.deepEqual(imageSize(JPEG_64x32, "image/jpeg"), { width: 64, height: 32 });
});

test("valida tipo, peso y que se pueda leer", () => {
  assert.equal(validateImage(PNG_1x1).width, 1);
  assert.throws(() => validateImage(Buffer.from("hola, no soy una imagen")), { message: "unsupported_type" });
  assert.throws(() => validateImage(PNG_1x1, { maxBytes: 10 }), { message: "too_large" });
  assert.throws(() => validateImage(PNG_1x1.subarray(0, 14)), { message: "unreadable_image" });
  assert.throws(() => validateImage(Buffer.alloc(0)), { message: "image_required" });
});

test("códigos de inventario: siguen al más alto", () => {
  assert.equal(nextInventoryCode([]), "PX-001");
  assert.equal(nextInventoryCode(["PX-001", "PX-004", null, "OTRO-9"]), "PX-005");
});

test("atril: solo las marcadas, en orden, favoritas y aleatorio estable", () => {
  const arts = [
    { id: 1, createdOn: "2026-03-01", showOnEasel: true, isFavorite: false },
    { id: 2, createdOn: "2026-01-10", showOnEasel: true, isFavorite: true },
    { id: 3, createdOn: "2026-02-05", showOnEasel: false, isFavorite: true },
    { id: 4, createdOn: null, createdAt: "2026-05-01T10:00:00Z", showOnEasel: true, isFavorite: false },
  ];
  assert.deepEqual(easelSequence(arts).map((a) => a.id), [2, 1, 4], "cronológico, sin la oculta");
  assert.deepEqual(easelSequence(arts, { order: "favorites" }).map((a) => a.id), [2]);
  assert.deepEqual(easelSequence(arts.map((a) => ({ ...a, isFavorite: false })), { order: "favorites" }).length, 3, "sin favoritas: todas");
  const r1 = easelSequence(arts, { order: "random", seed: "2026-10-26" }).map((a) => a.id);
  assert.deepEqual(easelSequence(arts, { order: "random", seed: "2026-10-26" }).map((a) => a.id), r1, "misma semilla, mismo orden");
  assert.deepEqual([...r1].sort(), [1, 2, 4]);
  assert.equal(dailyIndex(3, "2026-10-26"), (dailyIndex(3, "2026-10-25") + 1) % 3, "una por día: avanza de a una");
  assert.deepEqual(easelSettings({ interval: "3h", order: "x", showOnHome: "0" }), { interval: "15s", order: "chronological", showOnHome: false });
});

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(sharedSchema);
  db.exec(ocioSchema);
  const dir = mkdtempSync(join(tmpdir(), "galeria-"));
  return { db, dir, gallery: createGallery(db, dir) };
}

test("galería: alta, edición, código único y borrado con sus archivos", (t) => {
  const { gallery, dir } = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = gallery.create({ image: PNG_1x1, thumb: PNG_1x1, originalName: "rana_pixel.png", fields: { technique: "Aseprite", isFavorite: "true" } });
  assert.equal(a.title, "rana pixel", "título a partir del nombre del archivo");
  assert.equal(a.inventoryCode, "PX-001");
  assert.equal(a.sizeLabel, "1 × 1 px");
  assert.equal(a.isFavorite, true);
  assert.equal(a.showOnEasel, true);
  assert.match(a.url, /^\/artworks\/.+\.png$/);
  assert.match(a.thumbUrl, /\.thumb\.png$/);
  assert.equal(readdirSync(dir).length, 2);

  const b = gallery.create({ image: GIF_1x1, fields: { title: "Atardecer", createdOn: "2026-01-02" } });
  assert.equal(b.inventoryCode, "PX-002");
  assert.equal(b.thumbUrl, b.url, "sin miniatura usa el original");
  assert.throws(() => gallery.create({ image: JPEG_64x32, thumb: JPEG_64x32 }), { message: "thumb_must_be_png" });
  assert.throws(() => gallery.update(b.id, { inventoryCode: "px-001" }), { message: "inventory_code_taken" });
  assert.equal(gallery.update(b.id, { inventoryCode: "" }).inventoryCode, "PX-002", "vaciar el código no lo borra");
  assert.equal(gallery.update(b.id, { showOnEasel: false, description: "  " }).showOnEasel, false);
  assert.equal(gallery.get(b.id).description, null);
  assert.throws(() => gallery.update(b.id, { title: "" }), { message: "title_required" });

  gallery.remove(a.id);
  assert.equal(gallery.list().length, 1);
  assert.equal(readdirSync(dir).length, 1, "borró la imagen y la miniatura");
  assert.throws(() => gallery.get(a.id), { message: "not_found" });
});

test("atril: configuración guardada y secuencia", (t) => {
  const { gallery, dir } = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(gallery.getEaselSettings(), { interval: "15s", order: "chronological", showOnHome: true });
  gallery.create({ image: PNG_1x1, fields: { title: "Uno", createdOn: "2026-01-01" } });
  gallery.create({ image: PNG_1x1, fields: { title: "Dos", createdOn: "2026-02-01", isFavorite: true } });
  assert.deepEqual(gallery.setEaselSettings({ interval: "daily", order: "favorites", showOnHome: false }), { interval: "daily", order: "favorites", showOnHome: false });
  const e = gallery.easel("2026-10-26");
  assert.deepEqual(e.items.map((i) => i.title), ["Dos"]);
  assert.equal(e.startIndex, 0);
  assert.equal(e.total, 2);
  assert.equal(existsSync(join(dir, e.items[0].imagePath)), true);
});
