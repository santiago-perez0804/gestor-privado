import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffBytes, checkImageFile, thumbSize, imageRendering, intervalMs, artworkCaption, MAX_IMAGE_MB } from "../src/lib/ocio/gallery.js";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const GIF = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);

test("reconoce el tipo real por los primeros bytes", () => {
  assert.equal(sniffBytes(PNG), "image/png");
  assert.equal(sniffBytes(GIF), "image/gif");
  assert.equal(sniffBytes(JPG), "image/jpeg");
  assert.equal(sniffBytes(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(sniffBytes(new Uint8Array(2)), null);
});

test("revisa el archivo antes de subirlo: tipo real (no la extensión) y peso", async () => {
  assert.deepEqual(await checkImageFile(new File([PNG], "rana.png")), { mime: "image/png" });
  assert.match((await checkImageFile(new File(["no soy imagen"], "trucho.png"))).error, /no es PNG, JPG ni GIF/);
  const big = { name: "enorme.png", size: (MAX_IMAGE_MB + 1) * 1024 * 1024, slice: () => new Blob([PNG]) };
  assert.match((await checkImageFile(big)).error, /pesa más de/);
});

test("miniatura: solo achica, sin pasar de 480 px de lado", () => {
  assert.equal(thumbSize(64, 64), null, "el pixel art chico se muestra del original");
  assert.deepEqual(thumbSize(1920, 1080), { width: 480, height: 270 });
  assert.deepEqual(thumbSize(500, 4000), { width: 60, height: 480 });
});

test("pixelado salvo fotos grandes en JPG; intervalos y rótulo", () => {
  assert.equal(imageRendering({ mime: "image/png", width: 4000, height: 4000 }), "pixelated");
  assert.equal(imageRendering({ mime: "image/jpeg", width: 64, height: 64 }), "pixelated");
  assert.equal(imageRendering({ mime: "image/jpeg", width: 3000, height: 2000 }), "auto");
  assert.equal(intervalMs("6s"), 6000);
  assert.equal(intervalMs("daily"), null);
  assert.equal(artworkCaption({ technique: "Aseprite", createdOn: "2026-03-02", sizeLabel: "64 × 64 px" }), "Aseprite · 2026 · 64 × 64 px");
  assert.equal(artworkCaption({}), "");
});
