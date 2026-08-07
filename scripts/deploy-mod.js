// Sube el mod local palworld-mods/PalworldEventLogger al server de Dathost
// y lo registra en mods.txt/mods.json. NO reinicia el server (UE4SS solo
// carga mods nuevos al arrancar) - eso se hace aparte, a mano, avisando a
// los jugadores conectados.
// Uso: npm run deploy-mod
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
const MOD_NAME = 'PalworldEventLogger';
const UE4SS_MODS_PATH = 'Binaries/Win64/ue4ss/Mods';

async function readRemoteFile(remotePath) {
  const res = await fetch(`${BASE_URL}/files/${remotePath}`, { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`leer ${remotePath} -> ${res.status}`);
  return res.text();
}

async function writeRemoteFile(remotePath, content) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/plain' }), path.basename(remotePath));
  const res = await fetch(`${BASE_URL}/files/${remotePath}`, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: form,
  });
  if (!res.ok) throw new Error(`escribir ${remotePath} -> ${res.status}: ${await res.text()}`);
}

function upsertModsTxt(text) {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().startsWith(`${MOD_NAME} :`));
  if (idx >= 0) {
    lines[idx] = `${MOD_NAME} : 1`;
    return lines.join('\n');
  }
  return text.trimEnd() + `\n${MOD_NAME} : 1\n`;
}

function upsertModsJson(text) {
  const mods = JSON.parse(text);
  const existing = mods.find((m) => m.mod_name === MOD_NAME);
  if (existing) {
    existing.mod_enabled = true;
  } else {
    mods.push({ mod_name: MOD_NAME, mod_enabled: true });
  }
  return JSON.stringify(mods, null, 4);
}

async function main() {
  const localScript = path.join(__dirname, '..', 'palworld-mods', MOD_NAME, 'Scripts', 'main.lua');
  const scriptContent = fs.readFileSync(localScript, 'utf8');

  console.log(`Subiendo ${MOD_NAME}/Scripts/main.lua...`);
  await writeRemoteFile(`${UE4SS_MODS_PATH}/${MOD_NAME}/Scripts/main.lua`, scriptContent);

  console.log('Registrando el mod en mods.txt...');
  const modsTxt = await readRemoteFile(`${UE4SS_MODS_PATH}/mods.txt`);
  await writeRemoteFile(`${UE4SS_MODS_PATH}/mods.txt`, upsertModsTxt(modsTxt));

  console.log('Registrando el mod en mods.json...');
  const modsJson = await readRemoteFile(`${UE4SS_MODS_PATH}/mods.json`);
  await writeRemoteFile(`${UE4SS_MODS_PATH}/mods.json`, upsertModsJson(modsJson));

  console.log(`\nListo. ${MOD_NAME} subido y habilitado. Falta reiniciar el server (Stop/Start) para que UE4SS lo cargue.`);
}

main().catch((err) => {
  console.error('Error desplegando el mod:', err.message);
  process.exit(1);
});
