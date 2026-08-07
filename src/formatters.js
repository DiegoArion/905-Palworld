const { EmbedBuilder } = require('discord.js');

const COLORS = {
  join: 0x57f287,
  leave: 0xed4245,
  chat: 0x5865f2,
  death: 0x99aab5,
  capture: 0xfee75c,
  status: 0xeb459e,
  leaderboard: 0x5865f2,
  dashboard: 0x2ecc71,
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

function formatUptime(totalSeconds) {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Embed del dashboard en vivo: estado del server + jugadores + rendimiento. */
function dashboardEmbed({ online, players, metrics, paused, error }) {
  const embed = new EmbedBuilder()
    .setColor(paused ? 0x99aab5 : online ? COLORS.dashboard : COLORS.leave)
    .setTitle('📊 Palworld — Estado en vivo')
    .setTimestamp();

  if (error) {
    embed.setDescription(`⚠️ No se pudo actualizar: ${error}`);
    return embed;
  }

  if (paused) {
    embed
      .addFields({ name: 'Servidor', value: '💤 En pausa (sin jugadores, se reactiva solo al conectarse alguien)' })
      .addFields({ name: 'Conectados', value: 'Nadie conectado ahora mismo.' });
    return embed;
  }

  embed.addFields({ name: 'Servidor', value: online ? '✅ En línea' : '⛔ Apagado', inline: true });

  if (metrics) {
    embed.addFields(
      { name: 'Jugadores', value: `${metrics.currentplayernum}/${metrics.maxplayernum}`, inline: true },
      { name: 'Día', value: `${metrics.days}`, inline: true },
      { name: 'FPS', value: `${Math.round(metrics.serverfps)}`, inline: true },
      { name: 'Uptime', value: formatUptime(metrics.uptime), inline: true },
      { name: 'Bases', value: `${metrics.basecampnum}`, inline: true }
    );
  }

  if (players) {
    const list = players.length
      ? players.map((p) => `• **${p.name}** (nivel ${p.level}, ${Math.round(p.ping)}ms)`).join('\n')
      : 'Nadie conectado ahora mismo.';
    embed.addFields({ name: 'Conectados', value: list });
  }

  return embed;
}

module.exports = {
  formatDuration,
  formatUptime,
  playerJoinEmbed,
  playerLeaveEmbed,
  chatEmbed,
  deathEmbed,
  captureEmbed,
  serverStatusEmbed,
  leaderboardEmbed,
  dashboardEmbed,
};
