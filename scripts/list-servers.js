// Lista los game servers de la cuenta de Dathost para encontrar el DATHOST_SERVER_ID correcto.
// Uso: npm run list-servers
require('dotenv').config();
const DathostClient = require('../src/dathostClient');

async function main() {
  const email = process.env.DATHOST_EMAIL;
  const password = process.env.DATHOST_PASSWORD;
  if (!email || !password) {
    console.error('Define DATHOST_EMAIL y DATHOST_PASSWORD en tu .env primero.');
    process.exit(1);
  }
  const dathost = new DathostClient({ email, password });
  const servers = await dathost.listServers();
  console.log(JSON.stringify(servers, null, 2));
}

main().catch((err) => {
  console.error('Error consultando Dathost:', err.message);
  process.exit(1);
});
