// Descarga una copia completa y real del Saved/ del server de Palworld
// (SaveGames + configs) a una carpeta local con timestamp, fuera del
// servidor. Pensado para correr a mano antes de tocar cosas riesgosas
// (mods, hooks custom) en el server en vivo.
// Uso: npm run backup
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { DATHOST_EMAIL, DATHOST_PASSWORD, DATHOST_SERVER_ID } = process.env;
if (!DATHOST_EMAIL || !DATHOST_PASSWORD || !DATHOST_SERVER_ID) {
  console.error('Define DATHOST_EMAIL, DATHOST_PASSWORD y DATHOST_SERVER_ID en tu .env primero.');
  process.exit(1);
}

const BASE_URL = `https://dathost.net/api/0.1/game-servers/${DATHOST_SERVER_ID}`;
const authHeader = 'Basic ' + Buffer.from(`${DATHOST_EMAIL}:${DATHOST_PASSWORD}`).toString('base64');

async function listFiles(remotePath) {
  const res = await fetch(`${BASE_URL}/files?path=${encodeURIComponent(remotePath)}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) throw new Error(`list ${remotePath} -> ${res.status}`);
  return res.json();
}

async function downloadFile(remotePath, localPath) {
  const res = await fetch(`${BASE_URL}/files/${remotePath}`, { headers: { Authorization: authHeader } });
  if (res.status === 404) return null; // Palworld rota sus propios snapshots de "backup/world/"; puede desaparecer entre el listado y la descarga
  if (!res.ok) throw new Error(`download ${remotePath} -> ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return buffer.length;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'backups', `palworld-saved-${stamp}`);

  const saveGamesEntries = await listFiles('Saved/SaveGames');
  const allFiles = saveGamesEntries.filter((e) => !e.path.endsWith('/')).map((e) => 'Saved/SaveGames/' + e.path);
  // El save vigente (fuera de "backup/world/") es lo critico: tiene que bajar si o si.
  // Los snapshots historicos de "backup/world/" los rota Palworld solo y pueden
  // desaparecer entre el listado y la descarga -> se bajan best-effort, se ignoran si faltan.
  const critical = allFiles.filter((p) => !p.includes('/backup/'));
  const bestEffort = allFiles.filter((p) => p.includes('/backup/'));
  critical.push('Saved/Config/WindowsServer/PalWorldSettings.ini', 'Saved/Config/WindowsServer/GameUserSettings.ini');

  console.log(`Descargando save actual (${critical.length} archivos) a ${outDir}...`);
  let totalBytes = 0;
  for (const remotePath of critical) {
    const localPath = path.join(outDir, remotePath);
    const size = await downloadFile(remotePath, localPath);
    if (size === null) throw new Error(`archivo critico no encontrado: ${remotePath}`);
    totalBytes += size;
    console.log(`  OK  ${remotePath}  (${size} bytes)`);
  }

  console.log(`\nDescargando historial de snapshots (${bestEffort.length} archivos, best-effort)...`);
  let skipped = 0;
  for (const remotePath of bestEffort) {
    const localPath = path.join(outDir, remotePath);
    const size = await downloadFile(remotePath, localPath);
    if (size === null) {
      skipped++;
      continue;
    }
    totalBytes += size;
  }

  console.log(
    `\nListo. Save actual respaldado completo (${critical.length} archivos). Historial: ${bestEffort.length - skipped}/${bestEffort.length} snapshots (${skipped} rotados durante la descarga, se ignoran).`
  );
  console.log(`Total ${(totalBytes / 1024).toFixed(1)} KB en:\n${outDir}`);
}

main().catch((err) => {
  console.error('Error haciendo el backup:', err.message);
  process.exit(1);
});
