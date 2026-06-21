// debug-pages.js – correr con: node debug-pages.js
// Abre cada página con puppeteer y vuelca la estructura de datos disponible
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

async function inspect(name, url) {
  console.log(`\n${'─'.repeat(50)}\n🔍 ${name}: ${url}`);
  const page = await browser.newPage();
  const captured = [];

  page.on('response', async res => {
    const u = res.url();
    if (!u.includes('api') && !u.includes('json') && !u.includes('product') && !u.includes('search')) return;
    try {
      const ct = res.headers()['content-type'] ?? '';
      if (!ct.includes('json')) return;
      const json = await res.json();
      const keys = Object.keys(json ?? {}).slice(0, 6);
      if (keys.length) captured.push({ url: u.slice(0, 80), keys });
    } catch {}
  });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // __NEXT_DATA__
  const nextData = await page.evaluate(() => {
    const nd = window.__NEXT_DATA__;
    if (!nd) return null;
    // Buscamos dónde están los productos
    const str = JSON.stringify(nd);
    const hasProducts = str.includes('"products"') || str.includes('"items"');
    return { hasProducts, topKeys: Object.keys(nd?.props?.pageProps ?? {}).slice(0, 10) };
  }).catch(() => null);

  // Scripts JSON embebidos
  const scriptData = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    return scripts
      .map(s => s.textContent?.trim() ?? '')
      .filter(t => t.startsWith('{') || t.startsWith('['))
      .slice(0, 3)
      .map(t => t.slice(0, 120));
  }).catch(() => []);

  console.log('  __NEXT_DATA__:', nextData ?? 'no encontrado');
  console.log('  APIs interceptadas:', captured.length);
  captured.slice(0, 5).forEach(c => console.log(`    • ${c.url} → keys: ${c.keys.join(', ')}`));
  if (scriptData.length) console.log('  Scripts JSON:', scriptData[0]?.slice(0, 100));

  await page.close();
}

await inspect('Nike AR',  'https://www.nike.com.ar/ultimos-lanzamientos');
await inspect('Supreme',  'https://us.supreme.com/collections/all');
await inspect('Adidas AR','https://www.adidas.com.ar/nuevo');

await browser.close();
console.log('\n✅ Debug terminado.');