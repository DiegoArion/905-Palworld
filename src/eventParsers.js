// Clasifica lineas crudas de la consola de Palworld.
//
// El log nativo de Palworld no trae chat/muertes/capturas (confirmado
// contra el server real: solo trae conexiones/desconexiones/comandos, que
// ya cubrimos via la REST API en playerWatcher). El unico patron real que
// vale la pena parsear ahora es el que escribe nuestro propio mod
// (palworld-mods/PalworldEventLogger), con un formato fijo y controlado por
// nosotros: "[EVENTLOG] TIPO|campo1|resto".
const PATTERNS = [
  {
    type: 'chat',
    regex: /\[EVENTLOG] CHAT\|([^|]*)\|(.*)/,
    groups: (m) => ({ name: m[1], message: m[2] }),
  },
  {
    type: 'capture',
    regex: /\[EVENTLOG] CAPTURE\|([^|]*)\|(.*)/,
    groups: (m) => ({ name: m[1], pal: m[2] }),
  },
];

/**
 * Clasifica una linea cruda de consola.
 * @param {string} line
 * @returns {{type: string, raw: string, groups: Record<string,string>} | null}
 */
function parseLine(line) {
  for (const { type, regex, groups } of PATTERNS) {
    const match = line.match(regex);
    if (match) {
      return { type, raw: line, groups: groups(match) };
    }
  }
  return null;
}

module.exports = { parseLine, PATTERNS };
