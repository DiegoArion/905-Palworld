const { EventEmitter } = require('events');

/**
 * Deriva un estado simple a partir de la respuesta de Dathost. El campo
 * exacto puede variar segun version de la API (se ha visto `on: boolean`);
 * se deja un fallback generico por si el shape difiere.
 */
function deriveStatus(server) {
  if (typeof server.on === 'boolean') return server.on ? 'online' : 'offline';
  if (typeof server.status === 'string') return server.status;
  return 'unknown';
}

class StatusWatcher extends EventEmitter {
  constructor(dathost, serverId, intervalMs) {
    super();
    this.dathost = dathost;
    this.serverId = serverId;
    this.intervalMs = intervalMs;
    this._lastStatus = null;
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
      const status = deriveStatus(server);
      if (status !== this._lastStatus) {
        const previous = this._lastStatus;
        this._lastStatus = status;
        // No se avisa la primera vez que arranca el bot, solo transiciones reales.
        if (previous !== null) {
          this.emit('change', { status, previous });
        }
      }
    } catch (err) {
      this.emit('error', err);
    } finally {
      this._polling = false;
    }
  }
}

module.exports = StatusWatcher;
