import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sharedSchema } from "../src/db/schema/shared.js";
import { fisicoSchema } from "../src/db/schema/fisico.js";
import { migrateFisicoV2 } from "../src/db/migrations/fisicoV2.js";
import { stripJpegMetadata, stripPngMetadata, hasExif } from "../src/lib/imageMeta.js";
import { createPrivateFiles } from "../src/services/storage/privateFiles.js";
import { createHistory } from "../src/services/fisico/history.js";
import { createPlans } from "../src/services/fisico/plans.js";
import { createBody } from "../src/services/fisico/body.js";
import { createPhotos } from "../src/services/fisico/photos.js";

/** JPEG mínimo con un bloque EXIF (como el de un celular, con "GPS") y medidas 640×480. */
export function jpegWithExif() {
  const seg = (marker, payload) => Buffer.concat([Buffer.from([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), Buffer.from("GPSLatitude -34.6037 GPSLongitude -58.3816", "latin1")]);
  const sof = Buffer.from([0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe1, exif),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    seg(0xc0, sof),
    seg(0xda, Buffer.from([0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00])),
    Buffer.from([0x12, 0x34, 0xff, 0xd9]),
  ]);
}

test("quita EXIF (ubicación) de JPEG y PNG sin romper la imagen", () => {
  const jpg = jpegWithExif();
  assert.equal(hasExif(jpg), true);
  const clean = stripJpegMetadata(jpg);
  assert.equal(hasExif(clean), false);
  assert.equal(clean.includes(Buffer.from("GPSLatitude")), false, "sin coordenadas");
  assert.deepEqual([...clean.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...clean.subarray(-2)], [0xff, 0xd9], "los datos de imagen intactos");
  assert.ok(clean.includes(Buffer.from("JFIF")), "lo que no es metadato queda");
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", Buffer.alloc(13)), chunk("eXIf", Buffer.from("GPS")), chunk("tEXt", Buffer.from("Comment")), chunk("IDAT", Buffer.from([1, 2])), chunk("IEND", Buffer.alloc(0))]);
  const pclean = stripPngMetadata(png);
  assert.equal(pclean.includes(Buffer.from("eXIf")), false);
  assert.equal(pclean.includes(Buffer.from("tEXt")), false);
  assert.ok(pclean.includes(Buffer.from("IDAT")));
});

test("almacenamiento privado: claves aleatorias y nada fuera de la carpeta", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "priv-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = createPrivateFiles(dir);
  const key = await files.save(Buffer.from("x"), "jpg");
  assert.match(key, /^[0-9a-f-]{36}\.jpg$/);
  assert.ok(await files.has(key));
  assert.equal(await files.has("../fisico.db"), false);
  assert.equal(await files.has("..\\..\\x.jpg"), false);
  assert.equal(await files.get("../fisico.db"), null, "nada fuera de la carpeta");
  assert.match(await files.save(Buffer.from("y"), "jpg", { thumbOf: key }), /\.thumb\.jpg$/);
});

test("fotos: subir sin EXIF, reemplazar la misma pose, comparar fechas y borrar con sus archivos", async (t) => {
  const db = await testDb();
  const dir = mkdtempSync(join(tmpdir(), "fotos-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const history = createHistory(db);
  const plans = createPlans(db, { history });
  const files = createPrivateFiles(dir);
  const photos = createPhotos(db, { files, body: createBody(db), plans });
  await db.prepare("INSERT INTO weights (weight, recordedAt, createdAt) VALUES (92.3, '2026-09-18T08:00', 'x'), (91.7, '2026-10-16T08:00', 'x')").run();
  await db.prepare("INSERT INTO measurement_sessions (id, measuredOn, createdAt) VALUES (1, '2026-09-18', 'x'), (2, '2026-10-16', 'x')").run();
  await db.prepare(
    "INSERT INTO measurements (sessionId, measuredOn, zone, valueCm, createdAt) VALUES (1, '2026-09-18', 'cintura', 97.5, 'x'), (2, '2026-10-16', 'cintura', 96.5, 'x'), (1, '2026-09-18', 'brazo', 36, 'x'), (2, '2026-10-16', 'brazo', 36.5, 'x')"
  ).run();

  const a = await photos.upload({ image: jpegWithExif(), thumb: jpegWithExif(), date: "2026-09-18", pose: "front" });
  assert.equal(a.width, 640);
  assert.equal(a.hasThumb, true);
  assert.equal(hasExif(await files.get((await photos.file(a.id)).key)), false, "guardada sin EXIF");
  assert.equal(hasExif(await files.get((await photos.file(a.id, { thumb: true })).key)), false);
  await assert.rejects(async () => await photos.upload({ image: Buffer.from("no soy imagen ni a palos"), date: "2026-09-18" }), { message: "unsupported_type" });
  await assert.rejects(async () => await photos.upload({ image: jpegWithExif(), date: "2026-09-18", pose: "arriba" }), { message: "invalid_pose" });
  await photos.upload({ image: jpegWithExif(), date: "2026-09-18", pose: "front" }); // reemplaza
  assert.equal(readdirSync(dir).length, 1, "la anterior y su miniatura se borraron");
  await photos.upload({ image: jpegWithExif(), date: "2026-10-16", pose: "front" });
  const l = await photos.list();
  assert.equal(l.sessions.length, 2);
  assert.equal(l.sessions[0].date, "2026-10-16");
  assert.equal(l.next.date, "2026-10-30", "cada 2 semanas");
  const c = await photos.compare("2026-09-18", "2026-10-16");
  assert.deepEqual([c.waistCm, c.armCm, c.weeks], [-1, 0.5, 4]);
  assert.ok(c.trendKg < 0);
  await assert.rejects(async () => await photos.compare("2026-10-16", "2026-09-18"), { message: "invalid_range" });
  await photos.removeSession(l.sessions[0].id);
  assert.equal((await photos.list()).sessions.length, 1);
  assert.equal(readdirSync(dir).length, 1);
});
