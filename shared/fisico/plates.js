// Calculadora de discos: qué poner de cada lado de la barra para llegar a un peso, con los discos
// que hay (cantidad por lado). Busca la combinación exacta con menos discos; si no existe, la más
// cercana por debajo.

const EPS = 1e-6;
const cents = (kg) => Math.round(kg * 100);

/**
 * @param {number} targetKg peso total buscado (barra incluida)
 * @param {number} barKg
 * @param {Record<string|number, number>} available kg del disco → cuántos hay por lado
 * @returns {{ perSide: number[], loadedKg: number, remainderKg: number, exact: boolean, belowBar: boolean }}
 */
export function platesPerSide(targetKg, barKg, available) {
  const side = cents((targetKg - barKg) / 2);
  if (side < 0) return { perSide: [], loadedKg: barKg, remainderKg: Math.round((targetKg - barKg) * 100) / 100, exact: false, belowBar: true };
  const plates = Object.entries(available || {})
    .map(([kg, n]) => ({ c: cents(Number(kg)), n: Number(n) || 0 }))
    .filter((p) => p.c > 0 && p.n > 0)
    .sort((a, b) => b.c - a.c);

  // Búsqueda exhaustiva (pocos tipos de disco): mejor = mayor carga ≤ objetivo, y con menos discos.
  let best = { sum: 0, used: [] };
  const used = [];
  const dfs = (i, sum) => {
    if (sum > side) return;
    if (sum > best.sum || (sum === best.sum && used.length < best.used.length)) best = { sum, used: [...used] };
    if (best.sum === side && used.length >= best.used.length) return;
    if (i >= plates.length) return;
    const p = plates[i];
    for (let k = Math.min(p.n, Math.floor((side - sum) / p.c)); k >= 0; k--) {
      for (let j = 0; j < k; j++) used.push(p.c);
      dfs(i + 1, sum + k * p.c);
      used.length -= k;
    }
  };
  dfs(0, 0);
  const perSide = best.used.map((c) => c / 100);
  const loadedKg = Math.round((barKg + (2 * best.sum) / 100) * 100) / 100;
  return { perSide, loadedKg, remainderKg: Math.round((targetKg - loadedKg) * 100) / 100, exact: Math.abs(best.sum - side) < EPS, belowBar: false };
}
