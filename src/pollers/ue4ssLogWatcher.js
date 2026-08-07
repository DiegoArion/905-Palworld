const { EventEmitter } = require('events');
const { parseLine } = require('../eventParsers');

const UE4SS_LOG_PATH = 'Binaries/Win64/ue4ss/UE4SS.log';

/**
 * Tailea UE4SS.log (donde escriben los mods Lua, incluido el nuestro con
 * lineas "[EVENTLOG] ...") y emite solo el contenido nuevo desde el ultimo
 * sondeo. La API de Dathost no soporta Range requests, asi que cada sondeo
 * baja el archivo entero -> a tener en cuenta si este archivo crece mucho
 * con el tiempo (no rota entre reinicios del server, solo se sigue
 * agrandando), en cuyo caso convendria pasar a otra fuente.
 */
class Ue4ssLogWatcher extends EventEmitter {
  constructor(dathost, serverId, intervalMs) {
    super();
    this.dathost = dathost;
    this.serverId = serverId;
    this.intervalMs = intervalMs;
    this._lastLength = null;
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
      const text = await this.dathost.getFileText(this.serverId, UE4SS_LOG_PATH);

      if (this._lastLength === null) {
        // Primer sondeo: solo establece la base, no reproduce el historial viejo.
        this._lastLength = text.length;
        return;
      }

      if (text.length < this._lastLength) {
        // El archivo se hizo mas chico (se roto/reemplazo) -> se reinicia la base.
        this._lastLength = text.length;
        return;
      }

      const newText = text.slice(this._lastLength);
      this._lastLength = text.length;

      for (const line of newText.split(/\r?\n/)) {
        if (!line) continue;
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

module.exports = Ue4ssLogWatcher;
