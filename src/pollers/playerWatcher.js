const { EventEmitter } = require('events');

/**
 * Sondea RCON (ShowPlayers) para detectar entradas/salidas y llevar el
 * playtime. Es la fuente de verdad para joins/leaves (mas confiable que
 * parsear texto de consola).
 */
class PlayerWatcher extends EventEmitter {
  constructor(rcon, store, intervalMs) {
    super();
    this.rcon = rcon;
    this.store = store;
    this.intervalMs = intervalMs;
    this._timer = null;
    this._polling = false;
  }

  start() {
    this.poll();
    this._timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
  }

  async poll() {
    if (this._polling) return; // evita solapar sondeos si uno se demora
    this._polling = true;
    try {
      const players = await this.rcon.getPlayers();
      const currentIds = new Set(players.map((p) => p.steamId));
      const previouslyOnline = this.store.getOnlinePlayers();

      for (const p of players) {
        if (!p.steamId) continue;
        const wasOnline = previouslyOnline.some((row) => row.steam_id === p.steamId);
        this.store.playerJoined({ steamId: p.steamId, playerUid: p.playerUid, name: p.name });
        if (!wasOnline) {
          this.emit('join', { name: p.name, steamId: p.steamId });
        }
      }

      for (const row of previouslyOnline) {
        if (!currentIds.has(row.steam_id)) {
          const sessionSeconds = row.session_start
            ? Math.max(0, Math.floor((Date.now() - row.session_start) / 1000))
            : 0;
          this.store.playerLeft(row.steam_id);
          this.emit('leave', { name: row.name, steamId: row.steam_id, sessionSeconds });
        }
      }
    } catch (err) {
      this.emit('error', err);
    } finally {
      this._polling = false;
    }
  }
}

module.exports = PlayerWatcher;
