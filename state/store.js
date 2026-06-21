// state/store.js
// Guarda en memoria los productos ya notificados y sus talles.
// En Railway persiste mientras el proceso esté corriendo.
// Si el bot se reinicia, solo notifica productos NUEVOS que aparezcan después.

const seenProducts = new Map(); // siteId -> Set<productId>
const seenSizes    = new Map(); // siteId -> Map<productId, Set<size>>

export function isNew(siteId, productId) {
  if (!seenProducts.has(siteId)) seenProducts.set(siteId, new Set());
  return !seenProducts.get(siteId).has(String(productId));
}

export function markSeen(siteId, productId) {
  if (!seenProducts.has(siteId)) seenProducts.set(siteId, new Set());
  seenProducts.get(siteId).add(String(productId));
}

export function bulkMarkSeen(siteId, productIds) {
  if (!seenProducts.has(siteId)) seenProducts.set(siteId, new Set());
  const set = seenProducts.get(siteId);
  productIds.forEach(id => set.add(String(id)));
}

// Normaliza un talle a string (soporta string o {name, url})
function sizeToStr(s) {
  return typeof s === 'string' ? s : (s?.name ?? String(s));
}

// Guarda los talles actuales de un producto
export function updateSizes(siteId, productId, sizes) {
  if (!seenSizes.has(siteId)) seenSizes.set(siteId, new Map());
  seenSizes.get(siteId).set(String(productId), new Set(sizes.map(sizeToStr)));
}

// Devuelve los talles que NO estaban guardados antes (talles nuevos)
export function getNewSizes(siteId, productId, currentSizes) {
  if (!seenSizes.has(siteId)) return [];
  const stored = seenSizes.get(siteId).get(String(productId));
  if (!stored) return [];
  return currentSizes.filter(s => !stored.has(sizeToStr(s)));
}

export function getStats() {
  const stats = {};
  for (const [site, ids] of seenProducts.entries()) {
    stats[site] = ids.size;
  }
  return stats;
}
