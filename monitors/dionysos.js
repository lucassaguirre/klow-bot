// monitors/dionysos.js – digitalsport.com.ar/dionysos/
import { getBrowser } from './browser.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://www.digitalsport.com.ar';
const URL  = `${BASE}/dionysos/`;

const EXCLUDE_KEYWORDS = [
  'limpiador','limpieza','protector','repelente','impermeabilizante',
  'gamuza','nobuck','suede','crema','spray','cepillo','cordón',
  'cordon','plantilla','kit ','bolsa','mochila','vaso','botella',
  'gorra','termo','mate','parlante','auricular','riñonera'
];

function isRealProduct(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (EXCLUDE_KEYWORDS.some(k => lower.includes(k))) return false;
  if (lower.includes('ver todo') || lower.includes('ingresos')) return false;
  return true;
}

// Extrae talles, imagen y variantes de la página del producto usando cheerio
async function getProductDetails(productUrl, productId) {
  try {
    const { data } = await axios.get(productUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const sizes    = [];
    const variants = []; // { size, variantCode } para el carrito

    // Talles disponibles = labels SIN clase "nostock"
    $('#sizes .sizeLbl:not(.nostock)').each((_, el) => {
      // El texto del talle es el primer nodo de texto directo del label
      const sizeText = $(el).contents()
        .filter((_, node) => node.type === 'text')
        .first().text().trim();
      if (!sizeText || sizeText === '') return;

      // El variant code está en el input correspondiente
      const labelFor    = $(el).attr('for');
      const variantCode = $(`input#${labelFor}`).attr('size'); // ej: "7M", "8", "9"

      sizes.push(sizeText);
      if (variantCode) {
        variants.push({ size: sizeText, variantCode });
      }
    });

    // Imagen principal del producto
    const imgSrc  = $('#gallery img.media').first().attr('src');
    const imageUrl = imgSrc ? `${BASE}${imgSrc.replace('/500x500', '/500x500')}` : null;

    return { sizes, variants, imageUrl };

  } catch (err) {
    return { sizes: ['Ver talles'], variants: [], imageUrl: null };
  }
}

// URL de carrito directo para Dionysos
// Formato: /stores/cart_add.php?store=3&product=ID&variant=CODE&qty=1
export function getDionysosCartUrl(productId, variantCode) {
  if (!productId || !variantCode) return `${URL}`;
  return `${BASE}/stores/cart_add.php?store=3&product=${productId}&variant=${productId}_${variantCode}&qty=1`;
}

export async function fetchDionysos() {
  const products = [];
  const browser  = await getBrowser();
  const page     = await browser.newPage();

  try {
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await autoScroll(page);
    await sleep(1000);

    const items = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/prod/"]');
      const seen  = new Set();
      const results = [];

      for (const link of links) {
        const href = link.href;
        if (seen.has(href)) continue;
        seen.add(href);

        const card    = link.closest('[class*="product"],[class*="item"],article,li') ?? link.parentElement;
        const nameEl  = card?.querySelector('[class*="name"],[class*="title"],h2,h3,p');
        const priceEl = card?.querySelector('[class*="price"],[class*="precio"]');

        const name  = nameEl?.textContent?.trim() ?? link.textContent?.trim() ?? '';
        const price = priceEl?.textContent?.trim() ?? '';

        results.push({ name, price, url: href });
      }
      return results;
    });

    console.log(`  [Dionysos] ${items.length} items, extrayendo detalles...`);

    for (const item of items) {
      if (!isRealProduct(item.name)) continue;

      // ID del producto desde la URL (número al final)
      const idMatch  = item.url.match(/-(\d+)\/?$/);
      const prodId   = idMatch?.[1] ?? '';

      // Obtenemos talles e imagen de la página del producto
      const { sizes, variants, imageUrl } = await getProductDetails(item.url, prodId);

      products.push({
        id:       prodId || item.url,
        name:     item.name,
        subtitle: '',
        price:    item.price || null,
        currency: 'ARS',
        sizes,
        variants, // guardamos para los links de carrito
        productId: prodId,
        url:      item.url,
        imageUrl,
        site:     'Dionysos'
      });

      await sleep(300);
    }

    console.log(`  [Dionysos] ${products.length} productos con talles`);
    if (products[0]) {
      console.log(`  [Dionysos] Ejemplo: ${products[0].name} – Talles: ${products[0].sizes.slice(0,5).join(', ')}`);
    }

  } catch (err) {
    console.error('[Dionysos] Error –', err.message);
  } finally {
    await page.close();
  }

  return products;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 300);
        total += 300;
        if (total >= 12000) { clearInterval(t); resolve(); }
      }, 150);
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
