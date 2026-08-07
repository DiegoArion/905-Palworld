const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('status').setDescription('Estado actual del servidor de Palworld'),

  async execute(interaction, { dathost, palworldApi, config }) {
    await interaction.deferReply();

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('Estado del servidor');

    try {
      const server = await dathost.getServer(config.dathost.serverId);
      const on = typeof server.on === 'boolean' ? server.on : null;
      embed.addFields({ name: 'Servidor', value: on === null ? 'desconocido' : on ? '✅ En línea' : '⛔ Apagado' });
    } catch (err) {
      embed.addFields({ name: 'Servidor', value: `⚠️ No se pudo consultar Dathost (${err.message})` });
    }

    try {
      const players = await palworldApi.getPlayers();
      const list = players.length
        ? players.map((p) => `• ${p.name} (nivel ${p.level})`).join('\n')
        : 'Nadie conectado ahora mismo.';
      embed.addFields({ name: `Jugadores conectados (${players.length})`, value: list });
    } catch (err) {
      embed.addFields({ name: 'Jugadores conectados', value: `⚠️ No se pudo consultar la API de Palworld (${err.message})` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
