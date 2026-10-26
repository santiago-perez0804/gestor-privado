/**
 * Exporta la página actual a PDF. En la app de escritorio se guarda directo (diálogo de "Guardar como");
 * en el navegador abre la impresión, donde se elige "Guardar como PDF". `fileName` va sin extensión.
 * @returns {Promise<{ saved?: string, canceled?: boolean, printed?: boolean }>}
 */
export async function exportPdf(fileName) {
  if (window.gestorDesktop?.savePdf) return window.gestorDesktop.savePdf(fileName);
  // El navegador propone el título de la página como nombre del archivo.
  const previous = document.title;
  const restore = () => (document.title = previous);
  document.title = fileName;
  window.addEventListener("afterprint", restore, { once: true });
  window.print();
  setTimeout(restore, 1000);
  return { printed: true };
}
