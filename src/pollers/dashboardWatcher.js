const { EventEmitter } = require('events');
const { isUnreachable } = require('../palworldApiClient');

/**
 * Arma el estado del dashboard en vivo (server on/off + jugadores + metricas)
 * y lo emite periodicamente para que se edite un unico mensaje fijado, en
 * vez de mandar mensajes nuevos cada vez.
 */
class DashboardWatcher extends EventEmitter {
  constructor(dathost, palworldApi, serverId, intervalMs) {
    super();
    this.dathost = dathost;
    this.palworldApi = palworldApi;
    this.serverId = serverId;
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
    if (this._polling) return;
    this._polling = true;
    try {
      const server = await this.dathost.getServer(this.serverId);
      const online = typeof server.on === 'boolean' ? server.on : null;

      let players = null;
      let metrics = null;
      let paused = false;
      if (online) {
        players = await this.palworldApi.getPlayers().catch(() => null);
        try {
          metrics = await this.palworldApi.getMetrics();
        } catch (err) {
          // El auto-pause de Dathost apaga el proceso (y su API) cuando el
          // server queda vacio; no es un error real, es un estado esperado.
          if (isUnreachable(err)) paused = true;
        }
      }

      this.emit('update', { online, players, metrics, paused });
    } catch (err) {
      this.emit('update', { online: null, error: err.message });
    } finally {
      this._polling = false;
    }
  }
}

module.exports = DashboardWatcher;
