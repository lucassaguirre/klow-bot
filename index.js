// index.js – KLOW Drop Monitor v2
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { startMonitor }              from './monitors/catalog-monitor.js';
import { registerCommands, handleInteraction } from './discord/commands.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`\n🚀 KLOW Drop Monitor online – ${client.user.tag}`);

  await registerCommands(
    client.user.id,
    process.env.DISCORD_GUILD_ID,
    process.env.DISCORD_TOKEN
  );

  await startMonitor(client);
});

client.on('interactionCreate', handleInteraction);
client.on('error', err => console.error('[Discord]', err.message));

client.login(process.env.DISCORD_TOKEN);
