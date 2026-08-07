const BASE_URL = 'https://dathost.net/api/0.1';

class DathostClient {
  constructor({ email, password }) {
    this.authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
  }

  async _request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Dathost API ${options.method || 'GET'} ${path} -> ${res.status}: ${body}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res.text();
  }

  /** Lista todos los game servers de la cuenta. Util para encontrar el DATHOST_SERVER_ID. */
  listServers() {
    return this._request('/game-servers');
  }

  /** Detalle de un server: estado (on/off), ip, puertos, etc. */
  getServer(serverId) {
    return this._request(`/game-servers/${serverId}`);
  }

  /** Ultimas N lineas de consola del server. */
  async getConsoleLines(serverId, lines = 200) {
    const result = await this._request(`/game-servers/${serverId}/console?lines=${lines}`);
    // La API puede devolver un array de strings o un objeto { lines: [...] } segun version.
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.lines)) return result.lines;
    return [];
  }

  /** Contenido completo de un archivo del server (ej. UE4SS.log). La API no soporta Range requests. */
  getFileText(serverId, remotePath) {
    return this._request(`/game-servers/${serverId}/files/${remotePath}`);
  }

  /** Envia una linea/comando a la consola del server. */
  sendConsoleCommand(serverId, line) {
    const body = new URLSearchParams({ line });
    return this._request(`/game-servers/${serverId}/console`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
}

module.exports = DathostClient;
