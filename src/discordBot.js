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

  client.once('clientReady', async () => {
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

  const channelCache = new Map();
  async function getChannel(channelId) {
    if (!channelCache.has(channelId)) {
      channelCache.set(channelId, client.channels.fetch(channelId));
    }
    return channelCache.get(channelId);
  }

  async function sendToChannel(payload, channelId = config.discord.channelId) {
    try {
      const channel = await getChannel(channelId);
      await channel.send(payload);
    } catch (err) {
      console.error('[discord] error enviando mensaje al canal:', err);
    }
  }

  /**
   * Crea (una vez) o edita un mensaje fijo en un canal, en vez de mandar
   * mensajes nuevos cada vez. getId/setId persisten el id del mensaje
   * (ej. en la base) para sobrevivir reinicios del bot.
   */
  async function upsertMessage(channelId, payload, { getId, setId }) {
    try {
      const channel = await getChannel(channelId);
      const existingId = getId();
      if (existingId) {
        try {
          const message = await channel.messages.fetch(existingId);
          await message.edit(payload);
          return;
        } catch {
          // El mensaje ya no existe (borrado a mano, etc.) -> se crea uno nuevo abajo.
        }
      }
      const message = await channel.send(payload);
      setId(message.id);
    } catch (err) {
      console.error('[discord] error actualizando mensaje fijo:', err);
    }
  }

  async function start() {
    await client.login(config.discord.token);
  }

  return { client, start, sendToChannel, upsertMessage };
}

module.exports = { createBot };
