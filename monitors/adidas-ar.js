// monitors/adidas-ar.js – adidas.com.ar (Puppeteer Stealth)
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

const BASE = 'https://www.adidas.com.ar';

// ---------- browser singleton ----------
// Reusar el mismo browser entre scans para no abrir/cerrar cada vez

let browserInstance = null;

async function getBrowser() {
  if (browserInstance) {
    try {
      // Verificar que sigue vivo
      await browserInstance.version();
      return browserInstance;
    } catch {
      browserInstance = null;
    }
  }
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--lang=es-AR',
    ],
  });
  return browserInstance;
}

async function fetchHtml(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });
  await page.setViewport({ width: 1366, height: 768 });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Esperar a que __NEXT_DATA__ esté en el DOM
    await page.waitForSelector('#__NEXT_DATA__', { timeout: 10000 }).catch(() => {});
    return await page.content();
  } finally {
    await page.close();
  }
}

// ---------- helpers ----------

async function fetchNextData(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) {
    console.warn('  [Adidas AR] __NEXT_DATA__ no encontrado en', url);
    return null;
  }
  return JSON.parse(raw);
}

async function fetchProductApi(productId, page) {
  // Llamar a la API interna desde dentro del browser (mismas cookies/sesión)
  const browser = await getBrowser();
  const apiPage = await browser.newPage();
  try {
    const response = await apiPage.goto(`${BASE}/api/products/${productId}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
    const text = await response.text();
    return JSON.parse(text);
  } finally {
    await apiPage.close();
  }
}

// ---------- extraer catálogo ----------

async function getCatalogProducts(path) {
  const nextData = await fetchNextData(`${BASE}${path}`);
  if (!nextData) return [];

  const pp = nextData?.props?.pageProps;
  if (!pp) return [];

  // Estructura actual de Adidas AR: pageProps.products directamente
  const raw = pp.products;
  if (raw) {
    if (Array.isArray(raw) && raw.length)        return raw;
    if (Array.isArray(raw?.items) && raw.items.length) return raw.items;
    if (Array.isArray(raw?.products) && raw.products.length) return raw.products;
  }

  // Fallback: estructura antigua con dehydratedState.queries
  const queries = pp?.dehydratedState?.queries ?? [];
  for (const q of queries) {
    const d = q?.state?.data;
    if (!d) continue;
    if (d?.itemList?.products?.length)    return d.itemList.products;
    if (d?.products?.length)              return d.products;
    if (d?.productGrid?.products?.length) return d.productGrid.products;
    if (d?.plp?.products?.length)         return d.plp.products;
  }

  return [];
}

// ---------- mappers ----------

function mapApiProduct(d) {
  if (!d?.id) return null;
  const id    = d.id;
  const name  = (d.name ?? 'ADIDAS').toUpperCase();
  const price = d.pricing_information?.currentPrice
              ?? d.pricing_information?.standard_price
              ?? 0;
  const canonical = d.meta_data?.canonical ?? '';
  const url = canonical.startsWith('//') ? `https:${canonical}` : `${BASE}/`;
  const image = d.view_list?.[0]?.image_url ?? '';
  const sizes = (d.variation_list ?? []).map(v => {
    const shortName = v.size?.split(' ')?.[0] ?? v.size;
    return { name: shortName, url: `${url}?forceSelSize=${encodeURIComponent(v.size)}` };
  });
  return { id, name, price, url, imageUrl: image, sizes, currency: 'ARS', site: 'Adidas Argentina' };
}

function mapCatalogProduct(p) {
  const id = p.productId ?? p.id ?? p.modelId;
  if (!id) return null;
  const name  = (p.displayName ?? p.name ?? p.title ?? 'ADIDAS').toUpperCase();
  const price = p.price?.value ?? p.price?.original ?? p.salePrice ?? p.currentPrice ?? 0;
  const url   = p.url ? `${BASE}${p.url}` : `${BASE}/novedades-hombre`;
  const image = p.image?.src ?? p.images?.[0]?.src ?? p.imageUrl ?? p.image_url ?? '';
  return { id, name, price, url, imageUrl: image, sizes: [], currency: 'ARS', site: 'Adidas Argentina' };
}

// ---------- export principal ----------

export async function fetchAdidasAR() {
  const catalogPaths = ['/novedades-hombre', '/novedades-mujer'];
  const seen   = new Set();
  const result = [];

  for (const path of catalogPaths) {
    let items = [];
    try {
      console.log(`  [Adidas AR] Cargando catálogo: ${path}`);
      items = await getCatalogProducts(path);
      console.log(`  [Adidas AR] ${items.length} productos en ${path}`);
    } catch (err) {
      console.error(`  [Adidas AR] Error catálogo ${path}: ${err.message}`);
      continue;
    }

    for (const item of items) {
      const productId = item.productId ?? item.id ?? item.modelId;
      if (!productId || seen.has(productId)) continue;
      seen.add(productId);

      try {
        const detail = await fetchProductApi(productId);
        const mapped = mapApiProduct(detail);
        if (mapped) result.push(mapped);
      } catch (_) {
        const mapped = mapCatalogProduct(item);
        if (mapped) result.push(mapped);
      }

      await sleep(400);
    }
  }

  console.log(`  [Adidas AR] Total: ${result.length} productos`);
  return result;
}

export function getAdidasCartUrl(productUrl, sizeName) {
  return sizeName
    ? `${productUrl}?forceSelSize=${encodeURIComponent(sizeName)}`
    : productUrl;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }