// Vuelca en vivo las lineas nuevas de la consola de Dathost, cada 5s.
// Usalo mientras generas eventos de prueba en el server real (entrar/salir,
// escribir en el chat, capturar un pal) para ver el formato EXACTO y poder
// calibrar los regex de src/eventParsers.js.
// Uso: npm run dump-console
require('dotenv').config();
const DathostClient = require('../src/dathostClient');
const { parseLine } = require('../src/eventParsers');

async function main() {
  const { DATHOST_EMAIL, DATHOST_PASSWORD, DATHOST_SERVER_ID } = process.env;
  if (!DATHOST_EMAIL || !DATHOST_PASSWORD || !DATHOST_SERVER_ID) {
    console.error('Define DATHOST_EMAIL, DATHOST_PASSWORD y DATHOST_SERVER_ID en tu .env primero.');
    process.exit(1);
  }
  const dathost = new DathostClient({ email: DATHOST_EMAIL, password: DATHOST_PASSWORD });

  let lastLine = null;
  console.log('Escuchando consola... (Ctrl+C para salir)\n');

  setInterval(async () => {
    try {
      const lines = await dathost.getConsoleLines(DATHOST_SERVER_ID, 200);
      if (lines.length === 0) return;

      if (lastLine === null) {
        lastLine = lines[lines.length - 1];
        return;
      }

      const idx = lines.lastIndexOf(lastLine);
      const newLines = idx === -1 ? lines : lines.slice(idx + 1);
      lastLine = lines[lines.length - 1];

      for (const line of newLines) {
        const parsed = parseLine(line);
        const tag = parsed ? `[${parsed.type}]` : '[sin-clasificar]';
        console.log(`${tag} ${line}`);
      }
    } catch (err) {
      console.error('Error leyendo consola:', err.message);
    }
  }, 5000);
}

main();
