// test-sites.js – correlo con: node test-sites.js
// Te dice exactamente qué responde cada sitio desde TU máquina

import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'es-AR,es;q=0.9',
};

async function test(name, url, extraHeaders = {}) {
  try {
    const { data, status } = await axios.get(url, {
      headers: { ...HEADERS, ...extraHeaders },
      timeout: 15000
    });
    const isJson = typeof data === 'object';
    const preview = isJson
      ? JSON.stringify(data).slice(0, 120)
      : String(data).slice(0, 120);
    console.log(`\n✅ ${name}: HTTP ${status}`);
    console.log(`   Preview: ${preview}`);
  } catch(e) {
    console.log(`\n❌ ${name}: HTTP ${e.response?.status ?? 'TIMEOUT'} – ${e.message.slice(0, 80)}`);
  }
}

console.log('🔍 Testeando sitios desde tu máquina...\n');

await test('Nike API (marketplace AR)',
  'https://api.nike.com/product_feed/threads/v2/?filter=marketplace(AR)&filter=language(es-419)&filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)',
  { Referer: 'https://www.nike.com.ar/' }
);

await test('Supreme products.json',
  'https://us.supreme.com/products.json?limit=3',
  { Referer: 'https://us.supreme.com/collections/all' }
);

await test('Supreme collections/new',
  'https://us.supreme.com/collections/new/products.json?limit=3',
  { Referer: 'https://us.supreme.com/collections/all' }
);

await test('Adidas AR search API',
  'https://www.adidas.com.ar/api/search/product?q=&start=0&sz=3&format=json',
  { Referer: 'https://www.adidas.com.ar/' }
);

await test('Adidas AR grid API',
  'https://www.adidas.com.ar/on/demandware.store/Sites-adidas-AR-Site/es_AR/Search-ProductGrid?q=&sz=4&start=0&format=ajax',
  { Referer: 'https://www.adidas.com.ar/', 'x-requested-with': 'XMLHttpRequest' }
);

await test('DigitalSport /products.json',
  'https://www.digitalsport.com.ar/products.json?limit=3',
  { Referer: 'https://www.digitalsport.com.ar/' }
);

await test('DigitalSport /collections/dionysos/products.json',
  'https://www.digitalsport.com.ar/collections/dionysos/products.json?limit=3',
  { Referer: 'https://www.digitalsport.com.ar/dionysos/' }
);

console.log('\n✅ Test terminado. Copiá todo el output y pasámelo.');
