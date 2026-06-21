// monitors/shopify.js
// Adaptador genérico para cualquier tienda Shopify.
// Usá esto para agregar nuevas tiendas fácilmente.
//
// Ejemplo de uso:
//   import { fetchShopify } from './shopify.js';
//   const products = await fetchShopify('https://misitienda.com', 'Mi Tienda');

import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept':     'application/json'
};

export async function fetchShopify(baseUrl, siteName, currency = 'ARS') {
  const products = [];
  let page = 1;

  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/products.json`, {
        params:  { limit: 250, page },
        headers: HEADERS,
        timeout: 12000
      });

      const items = data?.products ?? [];
      if (!items.length) break;

      for (const item of items) {
        const sizes = item.variants
          .filter(v => v.available)
          .map(v => v.title !== 'Default Title' ? v.title : 'Único')
          .filter(Boolean);

        if (!sizes.length) continue;

        const variant  = item.variants.find(v => v.available);
        const priceRaw = variant?.price ?? item.variants?.[0]?.price;

        products.push({
          id:       String(item.id),
          name:     item.title,
          subtitle: item.product_type ?? item.vendor ?? '',
          price:    priceRaw ? parseFloat(priceRaw).toLocaleString('es-AR') : null,
          currency,
          sizes,
          url:      `${baseUrl}/products/${item.handle}`,
          imageUrl: item.images?.[0]?.src ?? null,
          site:     siteName
        });
      }

      if (items.length < 250) break;
      page++;
      await sleep(500);

    } catch (err) {
      console.error(`[${siteName}] Error –`, err.message);
      break;
    }
  }

  return products;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
