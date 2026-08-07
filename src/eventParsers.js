// Tabla de patrones para clasificar lineas crudas de la consola de Palworld.
//
// IMPORTANTE: estos patrones son una primera aproximacion basada en formatos
// reportados por la comunidad. Palworld no documenta oficialmente el formato
// de su log de consola, y por defecto probablemente NO incluya chat ni
// capturas/muertes (ver scripts/dump-console.js para validarlo contra el
// server real). Ajusta los regex aqui una vez que tengas ejemplos reales.
const PATTERNS = [
  {
    type: 'join',
    regex: /(?:LogSlate|LogTemp)?.*?player (?:has )?(?:logged in|connected)[:\s]+(?<name>[^\s(]+)/i,
  },
  {
    type: 'leave',
    regex: /(?:LogSlate|LogTemp)?.*?player (?:has )?(?:logged out|disconnected)[:\s]+(?<name>[^\s(]+)/i,
  },
  {
    type: 'chat',
    regex: /\[Chat](?:\s*\[(?<name>[^\]]+)])?\s*[:>]\s*(?<message>.+)/i,
  },
  {
    type: 'death',
    regex: /(?<name>[^\s]+) (?:was killed by|died to) (?<cause>.+)/i,
  },
  {
    type: 'capture',
    regex: /(?<name>[^\s]+) captured (?:a |an )?(?<pal>[^\s(]+)/i,
  },
  {
    type: 'serverStart',
    regex: /(?:Server has started|Listening on|LogPal.*Initialized)/i,
  },
  {
    type: 'serverStop',
    regex: /(?:Server is shutting down|LogPal.*Shutdown)/i,
  },
];

/**
 * Clasifica una linea cruda de consola.
 * @param {string} line
 * @returns {{type: string, raw: string, groups: Record<string,string>} | null}
 */
function parseLine(line) {
  for (const { type, regex } of PATTERNS) {
    const match = line.match(regex);
    if (match) {
      return { type, raw: line, groups: match.groups || {} };
    }
  }
  return null;
}

module.exports = { parseLine, PATTERNS };
