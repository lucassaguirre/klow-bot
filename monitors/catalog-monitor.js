// monitors/catalog-monitor.js
import { fetchNikeAR }       from './nike-ar.js';
import { fetchSupreme }      from './supreme.js';
import { fetchAdidasAR }     from './adidas-ar.js';
import { fetchDionysos }     from './dionysos.js';
import { fetchDionysosSale } from './dionysos-sale.js';
import { isNew, markSeen, bulkMarkSeen, getNewSizes, updateSizes } from '../state/store.js';
import { sendDropAlert, sendRestockAlert } from '../discord/notifier.js';

const SITES = [
  { id: 'nike-ar',        name: 'Nike Argentina',    fetch: fetchNikeAR,       channel: process.env.CHANNEL_NIKE_AR       },
  { id: 'supreme',        name: 'Supreme',           fetch: fetchSupreme,      channel: process.env.CHANNEL_SUPREME       },
  { id: 'adidas-ar',      name: 'Adidas Argentina',  fetch: fetchAdidasAR,     channel: process.env.CHANNEL_ADIDAS_AR     },
  { id: 'dionysos',       name: 'Dionysos',          fetch: fetchDionysos,     channel: process.env.CHANNEL_DIONYSOS      },
  { id: 'dionysos-sale',  name: 'Dionysos Ofertas',  fetch: fetchDionysosSale, channel: process.env.CHANNEL_DIONYSOS_SALE }
];

let isFirstScan = true;

export async function startMonitor(client) {
  const intervalSec = Number(process.env.SCAN_INTERVAL_SECONDS) || 60;

  // DEBUG: mostrar qué channel IDs se configuraron
  console.log('\n📋 Configuración de canales:');
  for (const site of SITES) {
    const hasId = site.channel ? '✅' : '❌';
    console.log(`  ${hasId} ${site.name}: ${site.channel ?? 'NO CONFIGURADO'}`);
  }

  console.log(`\n🔍 Monitor arrancado – escaneando ${SITES.length} sitios cada ${intervalSec}s`);
  console.log(`📦 Sitios: ${SITES.map(s => s.name).join(', ')}\n`);

  await runScan(client);
  setInterval(() => runScan(client), intervalSec * 1000);
}

async function runScan(client) {
  const label = isFirstScan ? '🔄 Baseline inicial' : '🔍 Scan';
  console.log(`\n${label} – ${new Date().toLocaleTimeString('es-AR')}`);

  for (const site of SITES) {
    try {
      const products = await site.fetch();
      console.log(`  [${site.name}] ${products.length} productos en stock`);

      if (isFirstScan) {
        bulkMarkSeen(site.id, products.map(p => p.id));
        for (const p of products) updateSizes(site.id, p.id, p.sizes ?? []);
        continue;
      }

      let newCount = 0;
      for (const product of products) {
        if (isNew(site.id, product.id)) {
          markSeen(site.id, product.id);
          updateSizes(site.id, product.id, product.sizes ?? []);
          newCount++;
          console.log(`    → Nuevo producto: ${product.name}`);
          await sendDropAlert(client, product, site.channel);
          await sleep(1500);
        } else if (product.sizes?.length) {
          const newSizes = getNewSizes(site.id, product.id, product.sizes);
          if (newSizes.length > 0) {
            updateSizes(site.id, product.id, product.sizes);
            console.log(`    → Talles nuevos en: ${product.name} → ${newSizes.map(s => typeof s === 'string' ? s : s.name).join(', ')}`);
            await sendRestockAlert(client, product, newSizes, site.channel);
            await sleep(1500);
          }
        }
      }

      if (newCount > 0) {
        console.log(`  ✅ [${site.name}] ${newCount} producto(s) nuevo(s)`);
      }

    } catch (err) {
      console.error(`  ❌ [${site.name}] Error –`, err.message);
    }

    await sleep(800);
  }

  if (isFirstScan) {
    console.log(`\n✅ Baseline listo. Monitoreando desde ahora...`);
    isFirstScan = false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
