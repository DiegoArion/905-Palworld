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
        steam_id TEXT PRIMARY KEY,
        player_uid TEXT,
        name TEXT NOT NULL,
        total_seconds INTEGER NOT NULL DEFAULT 0,
        session_start INTEGER,
        online INTEGER NOT NULL DEFAULT 0
      );
    `);

    this._upsertBase = this.db.prepare(`
      INSERT INTO players (steam_id, player_uid, name, total_seconds, session_start, online)
      VALUES (@steamId, @playerUid, @name, 0, NULL, 0)
      ON CONFLICT(steam_id) DO UPDATE SET name = excluded.name, player_uid = excluded.player_uid
    `);
    this._startSession = this.db.prepare(
      `UPDATE players SET online = 1, session_start = @now WHERE steam_id = @steamId`
    );
    this._endSession = this.db.prepare(`
      UPDATE players
      SET online = 0,
          session_start = NULL,
          total_seconds = total_seconds + MAX(0, CAST((@now - session_start) / 1000 AS INTEGER))
      WHERE steam_id = @steamId AND online = 1
    `);
    this._getPlayer = this.db.prepare(`SELECT * FROM players WHERE steam_id = ?`);
    this._getOnline = this.db.prepare(`SELECT * FROM players WHERE online = 1`);
    this._getAll = this.db.prepare(`SELECT * FROM players`);
  }

  /** Marca a un jugador como conectado y arranca su sesion. Idempotente. */
  playerJoined({ steamId, playerUid, name }, now = Date.now()) {
    this._upsertBase.run({ steamId, playerUid: playerUid || null, name });
    const player = this._getPlayer.get(steamId);
    if (!player.online) {
      this._startSession.run({ steamId, now });
    }
  }

  /** Marca a un jugador como desconectado y acumula el tiempo de la sesion. */
  playerLeft(steamId, now = Date.now()) {
    this._endSession.run({ steamId, now });
  }

  getPlayer(steamId) {
    return this._getPlayer.get(steamId);
  }

  isOnline(steamId) {
    const player = this._getPlayer.get(steamId);
    return !!player && !!player.online;
  }

  /** Segundos totales acumulados, incluyendo la sesion en curso si esta online. */
  getPlaytimeSeconds(steamId, now = Date.now()) {
    const player = this._getPlayer.get(steamId);
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

  close() {
    this.db.close();
  }
}

module.exports = PlaytimeStore;
