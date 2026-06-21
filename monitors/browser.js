// monitors/browser.js
// Browser compartido con stealth plugin para bypassear Cloudflare.
// Supreme, Adidas y Dionysos lo usan.
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

let browser = null;

export async function getBrowser() {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  });
  console.log('  [Browser] Chrome stealth iniciado');
  return browser;
}

// Abre una página, espera a que cargue el JSON y lo devuelve
export async function fetchJSON(url, referer) {
  const b    = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-AR,es;q=0.9',
      'Referer': referer
    });
    // Interceptamos la respuesta para obtener el JSON directamente
    let jsonData = null;
    page.on('response', async res => {
      if (res.url().includes('/products.json') || res.url().includes('/products.json')) {
        try { jsonData = await res.json(); } catch {}
      }
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // Si no interceptamos JSON, intentamos obtenerlo del body
    if (!jsonData) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      try { jsonData = JSON.parse(bodyText); } catch {}
    }
    return jsonData;
  } finally {
    await page.close();
  }
}

// Scraping normal de HTML con stealth
export async function fetchHTML(url, referer) {
  const b    = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'Referer': referer });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return await page.content();
  } finally {
    await page.close();
  }
}
