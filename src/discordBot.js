const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

function loadCommands() {
  const dir = path.join(__dirname, 'commands');
  const commands = new Map();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const command = require(path.join(dir, file));
    commands.set(command.data.name, command);
  }
  return commands;
}

async function registerSlashCommands(config, commands) {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const body = [...commands.values()].map((c) => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body });
}

function createBot(config, ctx) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const commands = loadCommands();

  client.once('ready', async () => {
    console.log(`[discord] conectado como ${client.user.tag}`);
    try {
      await registerSlashCommands(config, commands);
      console.log('[discord] slash commands registrados');
    } catch (err) {
      console.error('[discord] error registrando slash commands:', err);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, ctx);
    } catch (err) {
      console.error(`[discord] error ejecutando /${interaction.commandName}:`, err);
      const payload = { content: 'Ocurrió un error ejecutando el comando.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  let channelPromise = null;
  async function getChannel() {
    if (!channelPromise) {
      channelPromise = client.channels.fetch(config.discord.channelId);
    }
    return channelPromise;
  }

  async function sendToChannel(payload) {
    try {
      const channel = await getChannel();
      await channel.send(payload);
    } catch (err) {
      console.error('[discord] error enviando mensaje al canal:', err);
    }
  }

  async function start() {
    await client.login(config.discord.token);
  }

  return { client, start, sendToChannel };
}

module.exports = { createBot };
