// Cliente para la REST API oficial de Palworld (docs.palworldgame.com/category/rest-api).
// Reemplaza a RCON: Palworld lo tiene deprecado y su protocolo falla el
// handshake con clientes estandar; la REST API es el reemplazo oficial y ya
// viene habilitada en Dathost (palworld_settings.enable_rest_api). Sirve
// texto plano (HTTP), no HTTPS.
//
// Dathost pausa el proceso del juego (y con el su REST API) cuando el
// servidor queda sin jugadores por un rato, para ahorrar costos
// (enable_server_auto_pause). Mientras esta pausado, esta API rechaza la
// conexion (ECONNREFUSED) aunque Dathost siga reportando el server como
// "on". Es un estado esperado, no una falla real.
function isUnreachable(err) {
  const code = err && err.cause && err.cause.code;
  return code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || err.name === 'AbortError';
}

class PalworldApiClient {
  constructor({ host, port, password }) {
    this.baseUrl = `http://${host}:${port}/v1/api`;
    this.authHeader = 'Basic ' + Buffer.from(`admin:${password}`).toString('base64');
  }

  async _request(pathname, options = {}) {
    const res = await fetch(`${this.baseUrl}${pathname}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        ...options.headers,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Palworld API ${options.method || 'GET'} ${pathname} -> ${res.status}: ${body}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  getInfo() {
    return this._request('/info');
  }

  getMetrics() {
    return this._request('/metrics');
  }

  /** Jugadores conectados: [{ name, accountName, playerId, userId, ping, level, ... }].
   * Si el server esta pausado por inactividad, devuelve [] (es lo correcto:
   * el auto-pause de Dathost solo ocurre cuando ya no hay nadie conectado). */
  async getPlayers() {
    try {
      const result = await this._request('/players');
      return (result && result.players) || [];
    } catch (err) {
      if (isUnreachable(err)) return [];
      throw err;
    }
  }

  announce(message) {
    return this._request('/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  }
}

module.exports = PalworldApiClient;
module.exports.isUnreachable = isUnreachable;
