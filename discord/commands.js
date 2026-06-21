// discord/commands.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes
} from 'discord.js';
import { getStats } from '../state/store.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Estado del monitor y productos registrados'),

  new SlashCommandBuilder()
    .setName('sites')
    .setDescription('Ver qué sitios se están monitoreando')
];

export async function registerCommands(clientId, guildId, token) {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log('✅ Slash commands registrados');
}

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    const stats   = getStats();
    const total   = Object.values(stats).reduce((a, b) => a + b, 0);
    const uptime  = process.uptime();
    const hours   = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const embed = new EmbedBuilder()
      .setColor(0x1E90FF)
      .setTitle('⚙️ KLOW Drop Monitor – Estado')
      .addFields(
        { name: 'Uptime',              value: `${hours}h ${minutes}m`,      inline: true },
        { name: 'Productos en memoria', value: String(total),               inline: true },
        { name: 'Intervalo de scan',    value: `${process.env.SCAN_INTERVAL_SECONDS ?? 45}s`, inline: true },
        ...Object.entries(stats).map(([site, count]) => ({
          name:   site,
          value:  `${count} productos vistos`,
          inline: true
        }))
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } else if (interaction.commandName === 'sites') {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1E90FF)
        .setTitle('🌐 Sitios monitoreados')
        .setDescription(
          '🔵 Nike Argentina – `nike.com/ar`\n' +
          '🔴 Supreme – `supremenewyork.com`\n' +
          '⚫ Adidas Argentina – `adidas.com.ar`\n' +
          '🟣 Dionysos Argentina – `dionysosarg.com`'
        )
      ]
    });
  }
}
