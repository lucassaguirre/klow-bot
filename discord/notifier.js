// discord/notifier.js
import { EmbedBuilder } from 'discord.js';
import { getNikeCartUrl }     from '../monitors/nike-ar.js';
import { getAdidasCartUrl }   from '../monitors/adidas-ar.js';
import { getSupremeCartUrl }  from '../monitors/supreme.js';

const SITE_COLOR = {
  'Nike Argentina':    0x1E90FF,
  'Supreme':           0xCC0000,
  'Adidas Argentina':  0x111111,
  'Dionysos':          0x7B2FBE,
  'Dionysos Ofertas':  0xD92121
};

function formatTime() {
  return new Date().toLocaleTimeString('es-AR', { hour12: false });
}

function formatPrice(price, currency) {
  if (!price) return 'Consultar';
  const clean = String(price).replace(/\$+/g, '').replace(/\./g, '').replace(',', '.').trim();
  const num   = parseFloat(clean);
  if (isNaN(num)) return String(price).replace(/\$+/, '$');
  return currency === 'ARS' ? `$${num.toLocaleString('es-AR')}` : `USD $${num.toFixed(2)}`;
}

function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

function getCartUrl(product, size) {
  // Nike VTEX → carrito directo por SKU
  if (product.site === 'Nike Argentina' && product.skuIds?.length) {
    const sku = product.skuIds.find(s => s.size === size);
    if (sku) return getNikeCartUrl(sku.skuId);
  }
  // Adidas AR → sizes ya trae la URL correcta con forceSelSize (se maneja arriba)
  // Supreme Shopify → carrito por variant ID
  if (product.site === 'Supreme') return getSupremeCartUrl(product, size);
  // Fallback → link al producto
  return product.url;
}

export async function sendDropAlert(client, product, channelId) {
  const finalChannelId = channelId || process.env.NOTIFY_CHANNEL_ID;
  const channel = await client.channels.fetch(finalChannelId).catch(() => null);
  if (!channel) { console.error(`[Notifier] Canal no encontrado: ${finalChannelId}`); return; }

  const color    = SITE_COLOR[product.site] ?? 0x1E90FF;
  const name     = (product.name ?? 'Producto').toUpperCase();

  // URL del embed — debe ser válida
  const embedUrl = isValidUrl(product.url) ? product.url : 'https://www.google.com';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(name)
    .setURL(embedUrl)
    .setFooter({ text: `${product.site} Monitor • ${formatTime()}` });

  if (product.site === 'Dionysos Ofertas') {
    // Embed enfocado en el descuento: precio anterior tachado → precio actual, y % off
    const priceLine = product.priceBefore
      ? `~~${formatPrice(product.priceBefore, product.currency)}~~  →  **${formatPrice(product.price, product.currency)}**`
      : `**${formatPrice(product.price, product.currency)}**`;

    embed.addFields(
      { name: 'Precio',     value: priceLine, inline: false },
      { name: 'Descuento',  value: product.discountPct ? `${product.discountPct}%` : 'N/A', inline: true }
    );

    if (product.freeShipping) {
      embed.addFields({ name: 'Envío', value: '🚚 Gratis', inline: true });
    }
    if (product.tags?.length) {
      embed.addFields({ name: 'Tags', value: product.tags.join(' • '), inline: false });
    }

    if (product.sizes?.length) {
      const label = product.sizeType === 'zapatilla' ? 'Talles disponibles (Zapatilla)' : 'Talles disponibles (Prenda)';
      embed.addFields({ name: label, value: product.sizes.join(' • '), inline: false });
    }
  } else {
    // Talles como links clickeables
    // Soporta dos formatos:
    //   A) string[] → ['39', '40', '41']
    //   B) {name, url}[] → [{name: '39', url: 'https://...'}]  (Adidas AR)
    const sizesStr = product.sizes?.length
      ? product.sizes.map(s => {
          if (typeof s === 'string') return `[${s}](${getCartUrl(product, s)})`;
          return `[${s.name}](${s.url})`; // formato objeto {name, url}
        }).join('\n')
      : `[Ver talles](${embedUrl})`;

    embed.addFields(
      { name: 'Precio',             value: formatPrice(product.price, product.currency), inline: false },
      { name: 'Talles Disponibles', value: sizesStr, inline: false }
    );
  }

  if (product.subtitle) embed.setDescription(product.subtitle);
  if (product.imageUrl && isValidUrl(product.imageUrl)) embed.setThumbnail(product.imageUrl);

  // Sin botones — los talles/links en el embed ya son clickeables
  await channel.send({ embeds: [embed] });
}

export async function sendRestockAlert(client, product, newSizes, channelId) {
  const finalChannelId = channelId || process.env.NOTIFY_CHANNEL_ID;
  const channel = await client.channels.fetch(finalChannelId).catch(() => null);
  if (!channel) { console.error(`[Notifier] Canal no encontrado: ${finalChannelId}`); return; }

  const name     = (product.name ?? 'Producto').toUpperCase();
  const embedUrl = isValidUrl(product.url) ? product.url : 'https://www.google.com';

  const sizesStr = newSizes
    .map(s => typeof s === 'string' ? s : s.name)
    .join(' • ');

  const priceLine = product.priceBefore
    ? `~~${formatPrice(product.priceBefore, product.currency)}~~  →  **${formatPrice(product.price, product.currency)}**`
    : `**${formatPrice(product.price, product.currency)}**`;

  const embed = new EmbedBuilder()
    .setColor(0x00C853)
    .setTitle(`🔄 TALLES NUEVOS – ${name}`)
    .setURL(embedUrl)
    .setFooter({ text: `${product.site} Monitor • ${formatTime()}` })
    .addFields(
      { name: 'Precio',       value: priceLine,  inline: false },
      { name: 'Talles Nuevos', value: sizesStr,  inline: false }
    );

  if (product.subtitle) embed.setDescription(product.subtitle);
  if (product.imageUrl && isValidUrl(product.imageUrl)) embed.setThumbnail(product.imageUrl);

  await channel.send({ embeds: [embed] });
}
