const { EventEmitter } = require('events');
const { parseLine } = require('../eventParsers');

/**
 * Sondea la consola via API de Dathost y emite solo las lineas nuevas desde
 * el ultimo sondeo, clasificadas con eventParsers. La API devuelve una
 * ventana de las ultimas N lineas (no un cursor/offset), asi que la
 * deduplicacion se hace ubicando la ultima linea ya vista dentro de la
 * nueva ventana.
 */
class ConsoleWatcher extends EventEmitter {
  constructor(dathost, serverId, intervalMs, linesToFetch = 200) {
    super();
    this.dathost = dathost;
    this.serverId = serverId;
    this.intervalMs = intervalMs;
    this.linesToFetch = linesToFetch;
    this._lastLine = null;
    this._initialized = false;
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
      const lines = await this.dathost.getConsoleLines(this.serverId, this.linesToFetch);
      if (lines.length === 0) return;

      if (!this._initialized) {
        // En el primer sondeo solo establecemos la base; no reproducimos historial viejo.
        this._lastLine = lines[lines.length - 1];
        this._initialized = true;
        return;
      }

      const idx = lines.lastIndexOf(this._lastLine);
      const newLines = idx === -1 ? lines : lines.slice(idx + 1);
      this._lastLine = lines[lines.length - 1];

      for (const line of newLines) {
        this.emit('line', line);
        const parsed = parseLine(line);
        if (parsed) this.emit('event', parsed);
      }
    } catch (err) {
      this.emit('error', err);
    } finally {
      this._polling = false;
    }
  }
}

module.exports = ConsoleWatcher;
