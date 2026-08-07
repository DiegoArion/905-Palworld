const { SlashCommandBuilder } = require('discord.js');
const { formatDuration } = require('../formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playtime')
    .setDescription('Muestra el tiempo jugado de un jugador del server de Palworld')
    .addStringOption((opt) =>
      opt.setName('jugador').setDescription('Nombre (o parte del nombre) del jugador').setRequired(true)
    ),

  async execute(interaction, { store }) {
    const query = interaction.options.getString('jugador', true);
    const player = store.findByName(query);
    if (!player) {
      await interaction.reply({ content: `No encontré a ningún jugador que coincida con "${query}".`, ephemeral: true });
      return;
    }
    const seconds = store.getPlaytimeSeconds(player.player_uid);
    const estado = player.online ? ' (conectado ahora mismo)' : '';
    await interaction.reply(`**${player.name}** ha jugado **${formatDuration(seconds)}**${estado}.`);
  },
};
