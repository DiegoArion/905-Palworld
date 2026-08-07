const { ActivityType } = require('discord.js');
const config = require('./src/config');
const DathostClient = require('./src/dathostClient');
const PalworldApiClient = require('./src/palworldApiClient');
const PlaytimeStore = require('./src/store');
const PlayerWatcher = require('./src/pollers/playerWatcher');
const Ue4ssLogWatcher = require('./src/pollers/ue4ssLogWatcher');
const StatusWatcher = require('./src/pollers/statusWatcher');
const DashboardWatcher = require('./src/pollers/dashboardWatcher');
const { createBot } = require('./src/discordBot');
const { scheduleLeaderboard } = require('./src/leaderboardCron');
const { deathEmbed, captureEmbed, serverStatusEmbed, dashboardEmbed } = require('./src/formatters');
const { palDisplayName, palIconUrl } = require('./src/palSpecies');

async function main() {
  const dathost = new DathostClient(config.dathost);
  const palworldApi = new PalworldApiClient(config.palworldApi);
  const store = new PlaytimeStore(config.dbPath);

  const bot = createBot(config, { store, palworldApi, dathost, config });

  const playerWatcher = new PlayerWatcher(palworldApi, store, config.polling.playerMs);
  const ue4ssLogWatcher = new Ue4ssLogWatcher(dathost, config.dathost.serverId, config.polling.consoleMs);
  const statusWatcher = new StatusWatcher(dathost, config.dathost.serverId, config.polling.statusMs);
  const dashboardWatcher = new DashboardWatcher(dathost, palworldApi, config.dathost.serverId, config.polling.dashboardMs);

  // Joins/leaves no se anuncian como mensajes (se considero invasivo); el
  // tracking de playtime sigue andando igual dentro de playerWatcher.poll().
  playerWatcher.on('error', (err) => console.error('[playerWatcher]', err.message));

  ue4ssLogWatcher.on('event', (parsed) => {
    const { type, groups } = parsed;
    if (type === 'death') {
      bot.sendToChannel({ embeds: [deathEmbed(groups.name, groups.cause)] }, config.discord.logsChannelId);
    } else if (type === 'capture') {
      const palName = palDisplayName(groups.pal);
      const iconUrl = palIconUrl(groups.pal);
      bot.sendToChannel({ embeds: [captureEmbed(groups.name, palName, iconUrl)] }, config.discord.logsChannelId);
    }
    // El chat ya no se manda a Discord (el mod lo sigue registrando en
    // UE4SS.log, pero simplemente no reaccionamos a esas lineas).
  });
  ue4ssLogWatcher.on('error', (err) => console.error('[ue4ssLogWatcher]', err.message));

  statusWatcher.on('change', ({ status }) =>
    bot.sendToChannel({ embeds: [serverStatusEmbed(status)] }, config.discord.logsChannelId)
  );
  statusWatcher.on('error', (err) => console.error('[statusWatcher]', err.message));

  dashboardWatcher.on('update', (data) => {
    const { online, paused, metrics } = data;
    let presence = { name: 'servidor apagado', type: ActivityType.Watching };
    if (paused) {
      presence = { name: '0/? jugadores (en pausa)', type: ActivityType.Watching };
    } else if (online && metrics) {
      presence = { name: `${metrics.currentplayernum}/${metrics.maxplayernum} jugadores`, type: ActivityType.Watching };
    }
    bot.client.user?.setActivity(presence.name, { type: presence.type });

    if (config.discord.dashboardChannelId) {
      bot.upsertMessage(
        config.discord.dashboardChannelId,
        { embeds: [dashboardEmbed(data)] },
        {
          getId: () => store.getSetting('dashboardMessageId'),
          setId: (id) => store.setSetting('dashboardMessageId', id),
        }
      );
    }
  });

  await bot.start();

  playerWatcher.start();
  ue4ssLogWatcher.start();
  statusWatcher.start();
  dashboardWatcher.start(); // siempre corre: alimenta la presencia del bot ademas del dashboard opcional

  const leaderboardTask = scheduleLeaderboard({
    cronExpr: config.leaderboard.cron,
    timezone: config.leaderboard.timezone,
    store,
    sendToChannel: bot.sendToChannel,
  });

  function shutdown() {
    console.log('\nCerrando bot...');
    playerWatcher.stop();
    ue4ssLogWatcher.stop();
    statusWatcher.stop();
    dashboardWatcher.stop();
    leaderboardTask.stop();
    store.close();
    bot.client.destroy();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
  process.exit(1);
});
