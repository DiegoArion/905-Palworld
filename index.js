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
const {
  playerJoinEmbed,
  playerLeaveEmbed,
  chatEmbed,
  deathEmbed,
  captureEmbed,
  serverStatusEmbed,
  dashboardEmbed,
} = require('./src/formatters');
const { palDisplayName } = require('./src/palSpecies');

async function main() {
  const dathost = new DathostClient(config.dathost);
  const palworldApi = new PalworldApiClient(config.palworldApi);
  const store = new PlaytimeStore(config.dbPath);

  const bot = createBot(config, { store, palworldApi, dathost, config });

  const playerWatcher = new PlayerWatcher(palworldApi, store, config.polling.playerMs);
  const ue4ssLogWatcher = new Ue4ssLogWatcher(dathost, config.dathost.serverId, config.polling.consoleMs);
  const statusWatcher = new StatusWatcher(dathost, config.dathost.serverId, config.polling.statusMs);
  const dashboardWatcher = new DashboardWatcher(dathost, palworldApi, config.dathost.serverId, config.polling.dashboardMs);

  playerWatcher.on('join', ({ name }) => bot.sendToChannel({ embeds: [playerJoinEmbed(name)] }));
  playerWatcher.on('leave', ({ name, sessionSeconds }) =>
    bot.sendToChannel({ embeds: [playerLeaveEmbed(name, sessionSeconds)] })
  );
  playerWatcher.on('error', (err) => console.error('[playerWatcher]', err.message));

  ue4ssLogWatcher.on('event', (parsed) => {
    const { type, groups } = parsed;
    if (type === 'chat') {
      // El hook de chat tambien captura avisos de sistema (login/logout en
      // el idioma del cliente) ademas de mensajes reales de jugadores; esos
      // ya los cubre playerWatcher, asi que se descartan aca.
      if (groups.name === 'SYSTEM') return;
      bot.sendToChannel({ embeds: [chatEmbed(groups.name, groups.message)] });
    } else if (type === 'death') {
      bot.sendToChannel({ embeds: [deathEmbed(groups.name, groups.cause)] });
    } else if (type === 'capture') {
      bot.sendToChannel({ embeds: [captureEmbed(groups.name, palDisplayName(groups.pal))] });
    }
  });
  ue4ssLogWatcher.on('error', (err) => console.error('[ue4ssLogWatcher]', err.message));

  statusWatcher.on('change', ({ status }) => bot.sendToChannel({ embeds: [serverStatusEmbed(status)] }));
  statusWatcher.on('error', (err) => console.error('[statusWatcher]', err.message));

  dashboardWatcher.on('update', (data) => {
    bot.upsertMessage(
      config.discord.dashboardChannelId,
      { embeds: [dashboardEmbed(data)] },
      {
        getId: () => store.getSetting('dashboardMessageId'),
        setId: (id) => store.setSetting('dashboardMessageId', id),
      }
    );
  });

  await bot.start();

  playerWatcher.start();
  ue4ssLogWatcher.start();
  statusWatcher.start();
  if (config.discord.dashboardChannelId) dashboardWatcher.start();

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
