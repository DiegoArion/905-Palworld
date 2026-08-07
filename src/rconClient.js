const { Rcon } = require('rcon-client');

class PalworldRcon {
  constructor({ host, port, password }) {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  /** Abre una conexion RCON nueva, ejecuta el comando y cierra. Mas robusto que mantener
   * una conexion persistente contra un server que puede reiniciarse o cortar el socket. */
  async _run(command) {
    const rcon = await Rcon.connect({
      host: this.host,
      port: this.port,
      password: this.password,
      timeout: 5000,
    });
    try {
      return await rcon.send(command);
    } finally {
      rcon.end().catch(() => {});
    }
  }

  /** Devuelve la lista de jugadores conectados: [{ name, playerUid, steamId }] */
  async getPlayers() {
    const raw = await this._run('ShowPlayers');
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    // Primera linea es el header: name,playeruid,steamid
    const [, ...rows] = lines;
    return rows
      .map((row) => {
        const [name, playerUid, steamId] = row.split(',').map((s) => s.trim());
        if (!name) return null;
        return { name, playerUid, steamId };
      })
      .filter(Boolean);
  }

  /** Info basica del server (version, nombre). Sirve como ping de salud del RCON. */
  async getInfo() {
    return this._run('Info');
  }
}

module.exports = PalworldRcon;
