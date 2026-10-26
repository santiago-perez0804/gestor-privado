// Genera en memoria un PNG con la cara del sapo, así no hace falta versionar imágenes.
const zlib = require("node:zlib");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const GREEN = [76, 175, 80];
const DARK = [27, 94, 32];
const BELLY = [200, 230, 160];
const WHITE = [255, 255, 255];
const BLACK = [20, 20, 20];

function pixelColor(x, y) {
  // Coordenadas normalizadas 0..1
  const inEllipse = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (const cx of [0.3, 0.7]) {
    if (inEllipse(cx, 0.36, 0.08, 0.08)) return BLACK;
    if (inEllipse(cx, 0.34, 0.15, 0.15)) return WHITE;
    if (inEllipse(cx, 0.34, 0.19, 0.19)) return DARK;
  }
  if (inEllipse(0.5, 0.65, 0.48, 0.33)) {
    if (Math.abs(y - 0.72) < 0.025 && Math.abs(x - 0.5) < 0.22) return DARK;
    if (inEllipse(0.5, 0.82, 0.28, 0.14)) return BELLY;
    return GREEN;
  }
  if (inEllipse(0.5, 0.65, 0.5, 0.35)) return DARK;
  return null;
}

function makeFrogIconPng(size = 32) {
  const SS = 3; // supersampling para bordes suaves
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = pixelColor((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = a ? r / a : 0;
      raw[off + 1] = a ? g / a : 0;
      raw[off + 2] = a ? b / a : 0;
      raw[off + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = { makeFrogIconPng };
