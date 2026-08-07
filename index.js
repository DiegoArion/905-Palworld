const config = require('./src/config');
const DathostClient = require('./src/dathostClient');
const PalworldRcon = require('./src/rconClient');
const PlaytimeStore = require('./src/store');
const PlayerWatcher = require('./src/pollers/playerWatcher');
const ConsoleWatcher = require('./src/pollers/consoleWatcher');
const StatusWatcher = require('./src/pollers/statusWatcher');
const { createBot } = require('./src/discordBot');
const { scheduleLeaderboard } = require('./src/leaderboardCron');
const { playerJoinEmbed, playerLeaveEmbed, chatEmbed, deathEmbed, captureEmbed, serverStatusEmbed } = require('./src/formatters');

async function main() {
  const dathost = new DathostClient(config.dathost);
  const rcon = new PalworldRcon(config.rcon);
  const store = new PlaytimeStore(config.dbPath);

  const bot = createBot(config, { store, rcon, dathost, config });

  const playerWatcher = new PlayerWatcher(rcon, store, config.polling.playerMs);
  const consoleWatcher = new ConsoleWatcher(dathost, config.dathost.serverId, config.polling.consoleMs);
  const statusWatcher = new StatusWatcher(dathost, config.dathost.serverId, config.polling.statusMs);

  playerWatcher.on('join', ({ name }) => bot.sendToChannel({ embeds: [playerJoinEmbed(name)] }));
  playerWatcher.on('leave', ({ name, sessionSeconds }) =>
    bot.sendToChannel({ embeds: [playerLeaveEmbed(name, sessionSeconds)] })
  );
  playerWatcher.on('error', (err) => console.error('[playerWatcher]', err.message));

  consoleWatcher.on('event', (parsed) => {
    const { type, groups } = parsed;
    if (type === 'chat') {
      bot.sendToChannel({ embeds: [chatEmbed(groups.name, groups.message)] });
    } else if (type === 'death') {
      bot.sendToChannel({ embeds: [deathEmbed(groups.name, groups.cause)] });
    } else if (type === 'capture') {
      bot.sendToChannel({ embeds: [captureEmbed(groups.name, groups.pal)] });
    }
    // join/leave/serverStart/serverStop detectados en consola se ignoran a
    // proposito: RCON (playerWatcher) y la API de Dathost (statusWatcher)
    // son las fuentes de verdad para esos eventos.
  });
  consoleWatcher.on('error', (err) => console.error('[consoleWatcher]', err.message));

  statusWatcher.on('change', ({ status }) => bot.sendToChannel({ embeds: [serverStatusEmbed(status)] }));
  statusWatcher.on('error', (err) => console.error('[statusWatcher]', err.message));

  await bot.start();

  playerWatcher.start();
  consoleWatcher.start();
  statusWatcher.start();

  const leaderboardTask = scheduleLeaderboard({
    cronExpr: config.leaderboard.cron,
    timezone: config.leaderboard.timezone,
    store,
    sendToChannel: bot.sendToChannel,
  });

  function shutdown() {
    console.log('\nCerrando bot...');
    playerWatcher.stop();
    consoleWatcher.stop();
    statusWatcher.stop();
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
