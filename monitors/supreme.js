// monitors/supreme.js – us.supreme.com
// Los productos cargan client-side → esperamos a que aparezcan en el DOM
import { getBrowser } from './browser.js';

const BASE = 'https://us.supreme.com';

export async function fetchSupreme() {
  const products = [];
  const browser  = await getBrowser();
  const page     = await browser.newPage();
  let   captured = null;

  try {
    // Interceptar cualquier respuesta JSON con productos
    page.on('response', async res => {
      const url = res.url();
      if (!url.includes('supreme') && !url.includes('shopify')) return;
      try {
        const ct = res.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        const json = await res.json();
        if (json?.products?.length) captured = json;
      } catch {}
    });

    await page.goto(`${BASE}/collections/all`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Esperamos a que carguen los productos (Supreme usa lazy loading)
    try {
      await page.waitForSelector('a[href*="/products/"]', { timeout: 15000 });
    } catch {}

    // Scroll completo para cargar todos los productos
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let total = 0;
        const t = setInterval(() => {
          window.scrollBy(0, 500);
          total += 500;
          if (total >= 20000) { clearInterval(t); resolve(); }
        }, 200);
      });
    });
    await sleep(3000);

    // Si interceptamos JSON de la API de Shopify
    if (captured?.products?.length) {
      console.log(`  [Supreme] JSON interceptado: ${captured.products.length} productos`);
      for (const item of captured.products) {
        const available = item.variants.filter(v => v.available);
        if (!available.length) continue;
        const sizes = available.map(v => v.title === 'Default Title' ? 'One Size' : v.title);
        const variantIds = available.map(v => ({ size: v.title === 'Default Title' ? 'One Size' : v.title, id: String(v.id) }));
        products.push({
          id: String(item.id), name: item.title ?? 'Supreme',
          subtitle: item.product_type ?? '',
          price: available[0]?.price ? parseFloat(available[0].price).toFixed(2) : null,
          currency: 'USD', sizes, variantIds,
          url: `${BASE}/products/${item.handle}`,
          imageUrl: item.images?.[0]?.src ?? null,
          site: 'Supreme'
        });
      }
    } else {
      // Scraping DOM tras carga completa
      const cards = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        const seen  = new Set();
        return links
          .filter(a => { if (seen.has(a.href)) return false; seen.add(a.href); return true; })
          .map(a => {
            const card  = a.closest('li,article,[class*="product"],[class*="item"]') ?? a.parentElement;
            const name  = card?.querySelector('h1,h2,h3,p,[class*="name"],[class*="title"]')?.textContent?.trim()
              ?? a.textContent?.trim() ?? '';
            const price = card?.querySelector('[class*="price"]')?.textContent?.trim() ?? '';
            const img   = card?.querySelector('img')?.src ?? '';
            return { url: a.href, name, price, img };
          })
          .filter(p => p.url.includes('/products/') && p.name && p.name.length > 2);
      });

      console.log(`  [Supreme] DOM scraping: ${cards.length} productos`);
      for (const c of cards) {
        products.push({
          id: c.url, name: c.name ?? 'Supreme', subtitle: '',
          price: c.price || null, currency: 'USD',
          sizes: ['Ver talles'], variantIds: [],
          url: c.url, imageUrl: c.img || null, site: 'Supreme'
        });
      }
    }

    console.log(`  [Supreme] Total: ${products.length} productos`);

  } catch (err) {
    console.error('[Supreme] Error –', err.message);
  } finally {
    await page.close();
  }

  return products;
}

export function getSupremeCartUrl(product, size) {
  const v = product.variantIds?.find(x => x.size === size);
  return v?.id ? `${BASE}/cart/${v.id}:1` : product.url;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
