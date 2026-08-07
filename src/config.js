require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env (usa .env.example como plantilla).`);
  }
  return value;
}

function int(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`La variable de entorno ${name} debe ser un numero entero.`);
  }
  return parsed;
}

const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: required('DISCORD_GUILD_ID'),
    channelId: required('DISCORD_CHANNEL_ID'),
  },
  dathost: {
    email: required('DATHOST_EMAIL'),
    password: required('DATHOST_PASSWORD'),
    serverId: required('DATHOST_SERVER_ID'),
  },
  rcon: {
    host: required('PALWORLD_RCON_HOST'),
    port: int('PALWORLD_RCON_PORT', 25575),
    password: required('PALWORLD_RCON_PASSWORD'),
  },
  polling: {
    consoleMs: int('CONSOLE_POLL_INTERVAL_MS', 8000),
    playerMs: int('PLAYER_POLL_INTERVAL_MS', 20000),
    statusMs: int('STATUS_POLL_INTERVAL_MS', 60000),
  },
  leaderboard: {
    cron: process.env.LEADERBOARD_CRON || '0 21 * * *',
    timezone: process.env.LEADERBOARD_TIMEZONE || 'UTC',
  },
  dbPath: process.env.DB_PATH || './data/playtime.db',
};

module.exports = config;
