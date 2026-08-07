const { EventEmitter } = require('events');

/**
 * Sondea la REST API de Palworld (GET /v1/api/players) para detectar
 * entradas/salidas y llevar el playtime. Es la fuente de verdad para
 * joins/leaves (mas confiable que parsear texto de consola). Se identifica
 * a cada jugador por playerId (estable), no por nombre ni por userId (que
 * puede faltar en servers "nosteam").
 */
class PlayerWatcher extends EventEmitter {
  constructor(palworldApi, store, intervalMs) {
    super();
    this.palworldApi = palworldApi;
    this.store = store;
    this.intervalMs = intervalMs;
    this._timer = null;
    this._polling = false;
  }

  start() {
    this._reconcileStaleSessions();
    this.poll();
    this._timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
  }

  /**
   * Si el proceso se corto de golpe (crash, kill -9) en una corrida previa,
   * puede quedar algun jugador marcado "online" en la base aunque en
   * realidad ya se desconecto (y quiza se reconecto sin que lo vieramos).
   * Sin este paso, ese jugador nunca dispara un "join" de nuevo: el proximo
   * poll() lo ve online en la base Y online en el server real, y asume que
   * ya estaba. Cerramos esas sesiones colgadas al arrancar (sin avisar,
   * porque no es un leave real) para que el primer poll() genere un join
   * limpio si sigue conectado de verdad.
   */
  _reconcileStaleSessions() {
    for (const row of this.store.getOnlinePlayers()) {
      this.store.playerLeft(row.player_uid);
    }
  }

  async poll() {
    if (this._polling) return; // evita solapar sondeos si uno se demora
    this._polling = true;
    try {
      const players = await this.palworldApi.getPlayers();
      const currentIds = new Set(players.map((p) => p.playerId));
      const previouslyOnline = this.store.getOnlinePlayers();

      for (const p of players) {
        if (!p.playerId) continue;
        const wasOnline = previouslyOnline.some((row) => row.player_uid === p.playerId);
        this.store.playerJoined({ playerUid: p.playerId, steamId: p.userId, name: p.name });
        if (!wasOnline) {
          this.emit('join', { name: p.name, playerUid: p.playerId });
        }
      }

      for (const row of previouslyOnline) {
        if (!currentIds.has(row.player_uid)) {
          const sessionSeconds = row.session_start
            ? Math.max(0, Math.floor((Date.now() - row.session_start) / 1000))
            : 0;
          this.store.playerLeft(row.player_uid);
          this.emit('leave', { name: row.name, playerUid: row.player_uid, sessionSeconds });
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
