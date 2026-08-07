const { EmbedBuilder } = require('discord.js');

const COLORS = {
  join: 0x57f287,
  leave: 0xed4245,
  chat: 0x5865f2,
  death: 0x99aab5,
  capture: 0xfee75c,
  status: 0xeb459e,
  leaderboard: 0x5865f2,
};

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function playerJoinEmbed(name) {
  return new EmbedBuilder().setColor(COLORS.join).setDescription(`🟢 **${name}** se conectó al servidor`);
}

function playerLeaveEmbed(name, sessionSeconds) {
  return new EmbedBuilder()
    .setColor(COLORS.leave)
    .setDescription(`🔴 **${name}** se desconectó (jugó ${formatDuration(sessionSeconds)} esta sesión)`);
}

function chatEmbed(name, message) {
  return new EmbedBuilder().setColor(COLORS.chat).setDescription(`💬 **${name || 'Jugador'}**: ${message}`);
}

function deathEmbed(name, cause) {
  return new EmbedBuilder().setColor(COLORS.death).setDescription(`💀 **${name}** murió (${cause})`);
}

function captureEmbed(name, pal) {
  return new EmbedBuilder().setColor(COLORS.capture).setDescription(`🟡 **${name}** capturó un **${pal}**`);
}

function serverStatusEmbed(status) {
  const map = {
    online: { emoji: '✅', text: 'El servidor está **en línea**' },
    offline: { emoji: '⛔', text: 'El servidor está **apagado**' },
    starting: { emoji: '🟠', text: 'El servidor se está **iniciando**' },
  };
  const info = map[status] || { emoji: 'ℹ️', text: `Estado del servidor: ${status}` };
  return new EmbedBuilder().setColor(COLORS.status).setDescription(`${info.emoji} ${info.text}`);
}

function leaderboardEmbed(rows) {
  const embed = new EmbedBuilder().setColor(COLORS.leaderboard).setTitle('🏆 Tiempo jugado');
  if (rows.length === 0) {
    embed.setDescription('Todavía no hay datos de jugadores.');
    return embed;
  }
  const lines = rows.map((r, i) => `**${i + 1}.** ${r.name} — ${formatDuration(r.liveSeconds)}`);
  embed.setDescription(lines.join('\n'));
  return embed;
}

module.exports = {
  formatDuration,
  playerJoinEmbed,
  playerLeaveEmbed,
  chatEmbed,
  deathEmbed,
  captureEmbed,
  serverStatusEmbed,
  leaderboardEmbed,
};
