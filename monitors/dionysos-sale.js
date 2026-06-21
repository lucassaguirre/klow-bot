// monitors/dionysos-sale.js – digitalsport.com.ar/sale/prods/ (Ofertas / Descuentos)
// Toda la data (precio actual, precio anterior, % descuento) viene en HTML estático.
// No necesita Puppeteer: axios + cheerio alcanza y es mucho más rápido.

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://www.digitalsport.com.ar';
// Ordenado por "Lanzamiento" (available_at desc) para que las ofertas nuevas
// aparezcan primero en la página 1 — así detectamos drops nuevos sin paginar.
const URL  = `${BASE}/sale/prods/?sort=available_at%20desc&gender=1`;

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9',
};

// Solo estas marcas nos interesan en el canal de descuentos
const ALLOWED_BRANDS = ['nike', 'adidas', 'puma'];

function isBrandAllowed(brand, name = '') {
  const text = `${brand} ${name}`.toLowerCase();
  return ALLOWED_BRANDS.some(b => text.includes(b));
}

// "$68.999 " → 68999  |  "$100.000" → 100000
function cleanPrice(text) {
  if (!text) return null;
  const clean = text.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Talles numéricos (36, 36.5, 39…) = zapatilla; letras (S, M, L…) = prenda
function detectSizeType(sizes) {
  if (!sizes.length) return 'prenda';
  return /^\d/.test(sizes[0]) ? 'zapatilla' : 'prenda';
}

async function getProductDetails(productUrl) {
  try {
    const { data } = await axios.get(productUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const sizes = [];

    // Talles disponibles = labels SIN clase "nostock"
    $('#sizes .sizeLbl:not(.nostock)').each((_, el) => {
      const sizeText = $(el).contents()
        .filter((_, node) => node.type === 'text')
        .first().text().trim();
      if (sizeText) sizes.push(sizeText);
    });

    return { sizes, sizeType: detectSizeType(sizes) };

  } catch {
    return { sizes: [], sizeType: 'prenda' };
  }
}

export async function fetchDionysosSale() {
  const rawProducts = [];

  try {
    const { data: html } = await axios.get(URL, { headers: HEADERS, timeout: 20000 });
    const $ = cheerio.load(html);

    $('a.product').each((_, el) => {
      const $el = $(el);

      const productId = $el.attr('productid') ?? '';
      const href       = $el.attr('href') ?? '';
      const url        = href.startsWith('http') ? href : `${BASE}${href}`;
      const name       = ($el.attr('data-title') ?? $el.find('h3').text().trim() ?? 'Producto').toUpperCase();
      const brand      = $el.attr('data-brand') ?? $el.find('.brand').text().trim() ?? '';

      // Filtrar solo Nike, Adidas, Puma (busca en brand attr y en el nombre)
      if (!isBrandAllowed(brand, name)) return;

      const priceNowText    = $el.find('.precio').first().text().trim();
      const priceBeforeText = $el.find('.precio_antes span').first().text().trim();
      const discountText    = $el.find('.precio_descuento').first().text().trim(); // ej "-31%"

      const priceNow    = cleanPrice(priceNowText);
      const priceBefore = cleanPrice(priceBeforeText);
      const discountPct = discountText.replace('%', '').trim(); // ej "-31"

      const imgSrc    = $el.find('img.img').first().attr('data-src');
      const imageUrl  = imgSrc ? `${BASE}${imgSrc}` : null;

      const freeShipping = $el.find('.shipping').length > 0;
      const tags = $el.find('.tag_container .tag').map((_, t) => $(t).text().trim()).get();

      if (!productId || priceNow == null) return; // sin precio = no es producto válido

      rawProducts.push({
        id:           productId,
        name,
        subtitle:     brand ? brand.toUpperCase() : '',
        price:        priceNow,
        priceBefore,            // puede ser null si no hay descuento real
        discountPct,            // string ej "-31"
        currency:     'ARS',
        freeShipping,
        url,
        imageUrl,
        site:         'Dionysos Ofertas'
      });
    });

  } catch (err) {
    console.error('[Dionysos Ofertas] Error –', err.message);
  }

  // Obtener talles de cada producto filtrado visitando su página
  const products = [];
  for (const product of rawProducts) {
    const { sizes, sizeType } = await getProductDetails(product.url);
    products.push({ ...product, sizes, sizeType });
    await sleep(300);
  }

  console.log(`  [Dionysos Ofertas] ${products.length} productos Nike/Adidas/Puma en oferta`);
  return products;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
