// Fotos de progreso en el navegador: se re-codifican a JPEG con canvas antes de subirlas. Eso borra
// todos los metadatos (EXIF con la ubicación, el modelo del celular, la fecha), convierte HEIC del
// iPhone y achica fotos enormes. La orientación se respeta (el <img> la aplica antes de dibujar).

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error("unreadable_image")));
    img.src = url;
  });
}

async function toJpeg(file, maxSide, quality) {
  const { img, url } = await loadImage(file);
  try {
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) throw new Error("encode_failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** La foto lista para subir (JPEG sin metadatos, hasta 2000 px) y su miniatura (360 px). */
export async function preparePhoto(file) {
  const [image, thumb] = await Promise.all([toJpeg(file, 2000, 0.9), toJpeg(file, 360, 0.8)]);
  return { image, thumb };
}
