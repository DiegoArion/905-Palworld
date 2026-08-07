const cron = require('node-cron');
const { leaderboardEmbed } = require('./formatters');

function scheduleLeaderboard({ cronExpr, timezone, store, sendToChannel }) {
  return cron.schedule(
    cronExpr,
    async () => {
      const rows = store.getLeaderboard(10);
      await sendToChannel({ embeds: [leaderboardEmbed(rows)] });
    },
    { timezone }
  );
}

module.exports = { scheduleLeaderboard };
