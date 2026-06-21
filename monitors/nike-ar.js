// monitors/nike-ar.js – nike.com.ar (VTEX Catalog API)
import axios from 'axios';

const BASE = 'https://www.nike.com.ar';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'application/json',
  'Accept-Language': 'es-AR'
};

let lastSuccessfulProducts = [];

export async function fetchNikeAR() {
  const products = [];
  let from = 0;
  const step = 48;

  while (from < 600) {
    try {
      const { data } = await axios.get(`${BASE}/api/catalog_system/pub/products/search/`, {
        params: { O: 'OrderByReleaseDateDESC', _from: from, _to: from + step - 1 },
        headers: HEADERS,
        timeout: 15000
      });

      if (!data?.length) break;

      for (const item of data) {
        const availableSkus = (item.items ?? []).filter(sku =>
          sku.sellers?.some(s => s.commertialOffer?.IsAvailable === true)
        );
        if (!availableSkus.length) continue;

        const sizes  = availableSkus.map(s => s.Talle ?? s.Size ?? s.Tamanho ?? s.name).filter(Boolean);
        const seller = availableSkus[0]?.sellers?.find(s => s.commertialOffer?.IsAvailable);
        const price  = seller?.commertialOffer?.Price ?? null;
        const skuIds = availableSkus.map(s => ({ size: s.Talle ?? s.Size ?? s.name, skuId: s.itemId }));

        // URL siempre completa y válida
        const rawLink = item.link ?? '';
        const url = rawLink.startsWith('http')
          ? rawLink
          : `${BASE}${rawLink.startsWith('/') ? '' : '/'}${rawLink}`;

        products.push({
          id:       item.productId,
          name:     item.productName ?? 'Nike',
          subtitle: item.brand ?? '',
          price:    price ? price.toLocaleString('es-AR') : null,
          currency: 'ARS',
          sizes,
          skuIds,
          url,
          imageUrl: availableSkus[0]?.images?.[0]?.imageUrl ?? null,
          site:     'Nike Argentina'
        });
      }

      if (data.length < step) break;
      from += step;
      await sleep(600);

    } catch (err) {
      if (err.response?.status === 403) {
        if (products.length > 0) break;
        if (lastSuccessfulProducts.length > 0) {
          console.log(`  [Nike AR] Rate limited – usando cache (${lastSuccessfulProducts.length} productos)`);
          return lastSuccessfulProducts;
        }
        break;
      }
      break;
    }
  }

  if (products.length > 0) lastSuccessfulProducts = products;
  console.log(`  [Nike AR] ${products.length > 0 ? products.length : lastSuccessfulProducts.length} productos con stock`);
  return products.length > 0 ? products : lastSuccessfulProducts;
}

export function getNikeCartUrl(skuId) {
  return `${BASE}/checkout/cart/add?sku=${skuId}&qty=1&seller=1`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
