const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class PlaytimeStore {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        player_uid TEXT PRIMARY KEY,
        steam_id TEXT,
        name TEXT NOT NULL,
        total_seconds INTEGER NOT NULL DEFAULT 0,
        session_start INTEGER,
        online INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    this._getSetting = this.db.prepare(`SELECT value FROM settings WHERE key = ?`);
    this._setSetting = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    this._upsertBase = this.db.prepare(`
      INSERT INTO players (player_uid, steam_id, name, total_seconds, session_start, online)
      VALUES (@playerUid, @steamId, @name, 0, NULL, 0)
      ON CONFLICT(player_uid) DO UPDATE SET name = excluded.name, steam_id = excluded.steam_id
    `);
    this._startSession = this.db.prepare(
      `UPDATE players SET online = 1, session_start = @now WHERE player_uid = @playerUid`
    );
    this._endSession = this.db.prepare(`
      UPDATE players
      SET online = 0,
          session_start = NULL,
          total_seconds = total_seconds + MAX(0, CAST((@now - session_start) / 1000 AS INTEGER))
      WHERE player_uid = @playerUid AND online = 1
    `);
    this._getPlayer = this.db.prepare(`SELECT * FROM players WHERE player_uid = ?`);
    this._getOnline = this.db.prepare(`SELECT * FROM players WHERE online = 1`);
    this._getAll = this.db.prepare(`SELECT * FROM players`);
  }

  /** Marca a un jugador como conectado y arranca su sesion. Idempotente.
   * playerUid identifica al jugador de forma unica y siempre esta presente
   * (a diferencia de steamId, que viene vacio en servers "nosteam"). */
  playerJoined({ playerUid, steamId, name }, now = Date.now()) {
    this._upsertBase.run({ playerUid, steamId: steamId || null, name });
    const player = this._getPlayer.get(playerUid);
    if (!player.online) {
      this._startSession.run({ playerUid, now });
    }
  }

  /** Marca a un jugador como desconectado y acumula el tiempo de la sesion. */
  playerLeft(playerUid, now = Date.now()) {
    this._endSession.run({ playerUid, now });
  }

  getPlayer(playerUid) {
    return this._getPlayer.get(playerUid);
  }

  isOnline(playerUid) {
    const player = this._getPlayer.get(playerUid);
    return !!player && !!player.online;
  }

  /** Segundos totales acumulados, incluyendo la sesion en curso si esta online. */
  getPlaytimeSeconds(playerUid, now = Date.now()) {
    const player = this._getPlayer.get(playerUid);
    if (!player) return 0;
    let total = player.total_seconds;
    if (player.online && player.session_start) {
      total += Math.max(0, Math.floor((now - player.session_start) / 1000));
    }
    return total;
  }

  findByName(name) {
    return this.db
      .prepare(`SELECT * FROM players WHERE name LIKE ? ORDER BY total_seconds DESC LIMIT 1`)
      .get(`%${name}%`);
  }

  /** Top jugadores por tiempo jugado (incluye sesiones activas). */
  getLeaderboard(limit = 10, now = Date.now()) {
    const rows = this._getAll.all();
    return rows
      .map((p) => ({
        ...p,
        liveSeconds:
          p.total_seconds + (p.online && p.session_start ? Math.max(0, Math.floor((now - p.session_start) / 1000)) : 0),
      }))
      .sort((a, b) => b.liveSeconds - a.liveSeconds)
      .slice(0, limit);
  }

  getOnlinePlayers() {
    return this._getOnline.all();
  }

  /** Valores persistentes de configuracion/estado (ej. id del mensaje del dashboard). */
  getSetting(key) {
    const row = this._getSetting.get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    this._setSetting.run({ key, value });
  }

  close() {
    this.db.close();
  }
}

module.exports = PlaytimeStore;
