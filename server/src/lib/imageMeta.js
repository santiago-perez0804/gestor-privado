// Quitar metadatos de imágenes (EXIF con la ubicación, fecha, modelo del celular…) sin recomprimir.
// El navegador ya re-codifica las fotos a JPEG (eso borra todo); esto es la segunda barrera en el server.

/** JPEG: saca los segmentos APP1 (EXIF/XMP), APP13 (IPTC/Photoshop) y comentarios. */
export function stripJpegMetadata(buf) {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return buf;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    // Desde el inicio de los datos de la imagen (SOS) va todo tal cual.
    if (marker === 0xda) {
      parts.push(buf.subarray(i));
      return Buffer.concat(parts);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const end = i + 2 + len;
    if (end > buf.length) break;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(buf.subarray(i, end));
    i = end;
  }
  return buf; // estructura rara: se deja como vino (no rompemos la imagen)
}

const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

/** PNG: saca los chunks de texto, EXIF y fecha. */
export function stripPngMetadata(buf) {
  if (buf.toString("latin1", 1, 4) !== "PNG") return buf;
  const parts = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) return buf;
    if (!PNG_DROP.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

/** ¿Tiene EXIF? (para los tests y para avisar). */
export const hasExif = (buf) => buf.includes(Buffer.from("Exif\0\0", "latin1")) || buf.includes(Buffer.from("eXIf", "latin1"));
