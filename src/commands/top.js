const { SlashCommandBuilder } = require('discord.js');
const { leaderboardEmbed } = require('../formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Muestra el ranking de tiempo jugado')
    .addIntegerOption((opt) =>
      opt.setName('cantidad').setDescription('Cuantos jugadores mostrar (default 10)').setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction, { store }) {
    const limit = interaction.options.getInteger('cantidad') || 10;
    const rows = store.getLeaderboard(limit);
    await interaction.reply({ embeds: [leaderboardEmbed(rows)] });
  },
};
