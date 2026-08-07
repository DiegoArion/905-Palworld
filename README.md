# Palworld Discord Bot

Bot de Discord que reporta en un canal específico lo que pasa en un servidor de Palworld hosteado en **Dathost**: entradas/salidas de jugadores, estado del servidor, tiempo jugado (con leaderboard automático), y un dashboard en vivo con métricas (jugadores, FPS, día, uptime). Chat, muertes y capturas de Pals **no están disponibles** en este momento — ver la sección de Limitaciones.

## 1. Requisitos

- Node.js 18 o superior (tanto para probar en tu PC como en el servidor Ubuntu donde correrá 24/7)
- Una cuenta de Discord con permisos para crear una aplicación/bot e invitarlo a tu servidor
- Tu cuenta de Dathost (email + password) y el servidor de Palworld ya creado ahí
- Acceso SSH al servidor Ubuntu donde va a correr el bot

## 2. Crear el bot de Discord

1. Andá a https://discord.com/developers/applications → **New Application**.
2. En la pestaña **Bot** → **Add Bot** → copiá el **Token** (esto es `DISCORD_TOKEN`). No hace falta activar ningún "Privileged Gateway Intent".
3. En **OAuth2 → General**, copiá el **Client ID** (esto es `DISCORD_CLIENT_ID`).
4. En **OAuth2 → URL Generator**: marcá scopes `bot` y `applications.commands`, y en permisos: `View Channel`, `Send Messages`, `Embed Links`, `Use Application Commands`. Abrí la URL generada y agregá el bot a tu servidor.
5. En Discord, activá el **Modo desarrollador** (Ajustes de usuario → Avanzado), y con clic derecho copiá:
   - el ID del servidor → `DISCORD_GUILD_ID`
   - el ID del canal donde quieres los logs → `DISCORD_CHANNEL_ID`
   - el ID de un canal aparte para el dashboard de métricas (opcional) → `DISCORD_DASHBOARD_CHANNEL_ID`

## 3. Obtener datos de Dathost

- `DATHOST_EMAIL` / `DATHOST_PASSWORD`: las credenciales de tu cuenta de Dathost (se usan para autenticar contra su API REST).
- `DATHOST_SERVER_ID`: corré `npm run list-servers` (ver paso 4) una vez tengas el `.env` con email/password cargados, y copiá el `id` del server de Palworld que te interese del JSON que imprime.
- REST API del server de Palworld (no usamos RCON — está deprecado por Palworld y su protocolo falla el handshake con clientes estándar de Node):
  - `PALWORLD_API_HOST` y `PALWORLD_API_PORT`: el mismo `ip` del server y el campo `ports.rest_api` del JSON de `npm run list-servers`.
  - `PALWORLD_API_PASSWORD`: la "Admin Password" del server, pestaña **Settings** en el panel de Dathost.
  - Confirmá que `palworld_settings.enable_rest_api` sea `true` en el JSON de `list-servers` (si no, activalo desde el panel de Dathost).

## 4. Instalar y configurar (en tu PC, para probar antes de desplegar)

```bash
npm install
cp .env.example .env
# editá .env con todos los valores de los pasos 2 y 3
```

Verificá que encontrás el server correcto:

```bash
npm run list-servers
```

## 5. Limitaciones conocidas: chat, muertes y capturas

Ya lo validamos contra un server real en producción (300+ líneas de consola con actividad real): el log nativo de Palworld **solo trae conexiones, desconexiones y comandos ejecutados** (`[LOG] <nombre> connected/left/joined the server...`) — nada de chat, muertes ni capturas de Pals. Tampoco están en la REST API oficial (solo expone jugadores/info/métricas/anuncios/kick/ban).

La única forma real de conseguirlos es un mod de UE4SS tipo "Event Logs"/"Discord Chat Plugin" que hookea el motor del juego. Esto **no está incluido en esta versión** porque:
- Requiere revisar cuidadosamente que el mod soporte tu versión exacta de Palworld antes de subirlo (instalar uno incompatible puede crashear el server)
- Instalarlo implica un **stop/start completo del servidor** (desconecta a los jugadores activos ~1-3 min)

Si más adelante querés retomarlo, `scripts/dump-console.js` sigue disponible para volcar la consola en vivo y confirmar qué cambió.

## 6. El auto-pause de Dathost (importante para entender el comportamiento del bot)

Dathost pausa el proceso del juego (y su REST API) cuando el servidor queda **sin jugadores por un rato**, para ahorrar costos (`palworld_settings.enable_server_auto_pause`). Mientras está pausado:
- La API de Palworld rechaza conexiones (esto es esperado, el bot lo maneja sin generar errores ni spam de logs)
- El dashboard muestra "💤 En pausa" en vez de la lista de jugadores
- Se reactiva solo apenas alguien intenta conectarse

Si preferís que el server nunca se pause (por ejemplo, para que el dashboard siempre muestre métricas en vivo), podés desactivar `enable_server_auto_pause` desde el panel de Dathost — ojo que eso puede aumentar el costo si tu plan cobra por uso.

## 7. Probar localmente

```bash
npm start
```

Deberías ver en la consola que el bot se conecta y registra los slash commands. Probá `/status`, `/top` y `/playtime` en Discord, hacé un join/leave real en el server para confirmar que llegan los mensajes al canal, y revisá que el dashboard (si configuraste `DISCORD_DASHBOARD_CHANNEL_ID`) se publique y se vaya editando en lugar de mandar mensajes nuevos.

## 8. Subir el proyecto a git y llevarlo al servidor Ubuntu

Este proyecto ya tiene `git init` hecho y un `.gitignore` que excluye `node_modules/`, `.env` y la carpeta `data/` (base de datos SQLite) — **nunca subas el `.env`**, tiene tus contraseñas.

**Opción A — con un remoto (GitHub/GitLab privado), la más simple para actualizar después:**

```bash
# en tu PC, en la carpeta del proyecto
git add -A
git commit -m "Bot inicial"
git remote add origin git@github.com:tu-usuario/palworld-discord-bot.git
git push -u origin main
```

En el servidor Ubuntu:

```bash
git clone git@github.com:tu-usuario/palworld-discord-bot.git
cd palworld-discord-bot
cp .env.example .env   # y completá los valores (mismos del paso 3)
```

Para actualizar más adelante: `git pull` en el servidor + reiniciar el servicio (paso 9).

**Opción B — sin remoto, copiando el repo directo por SSH:**

```bash
# en tu PC
git bundle create palworld-bot.bundle --all
scp palworld-bot.bundle usuario@tu-servidor:/home/usuario/

# en el servidor Ubuntu
git clone palworld-bot.bundle palworld-discord-bot
cd palworld-discord-bot
cp .env.example .env   # y completá los valores
```

## 9. Instalar dependencias y correr como servicio en Ubuntu

```bash
# Node.js 18+ si no lo tenés (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

cd palworld-discord-bot
npm install --omit=dev
```

Copiá y ajustá el servicio systemd (`deploy/palworld-bot.service` ya trae un ejemplo — editá `User` y `WorkingDirectory` con tu usuario y ruta reales):

```bash
sudo cp deploy/palworld-bot.service /etc/systemd/system/palworld-bot.service
sudo systemctl daemon-reload
sudo systemctl enable --now palworld-bot
```

Ver logs en vivo:

```bash
journalctl -u palworld-bot -f
```

Reiniciar tras un `git pull` con cambios:

```bash
sudo systemctl restart palworld-bot
```

## Comandos disponibles en Discord

- `/status` — estado actual del servidor y jugadores conectados
- `/playtime jugador:<nombre>` — tiempo jugado acumulado de un jugador
- `/top [cantidad]` — ranking de tiempo jugado

Además, el bot postea automáticamente:
- Joins/leaves en tiempo real (vía la REST API de Palworld)
- Cambios de estado del servidor: online/offline (vía API de Dathost)
- Un resumen de leaderboard periódico (configurable con `LEADERBOARD_CRON` y `LEADERBOARD_TIMEZONE` en `.env`, por defecto todos los días a las 21:00)
- Un dashboard en vivo (mensaje fijo que se edita cada `DASHBOARD_POLL_INTERVAL_MS`, default 90s) en `DISCORD_DASHBOARD_CHANNEL_ID` con jugadores conectados, nivel, ping, FPS, día del server, uptime y cantidad de bases

## Estructura del proyecto

```
src/
  config.js            # variables de entorno
  dathostClient.js      # API REST de Dathost (estado del server, consola)
  palworldApiClient.js   # REST API de Palworld (jugadores, info, metrics)
  store.js              # SQLite: playtime por jugador
  pollers/               # sondeos periódicos (consola, jugadores, estado, dashboard)
  eventParsers.js        # regex para clasificar líneas de consola
  formatters.js          # embeds de Discord
  commands/               # slash commands
  discordBot.js           # cliente de discord.js
  leaderboardCron.js      # resumen automático periódico
scripts/
  list-servers.js        # lista tus servers de Dathost (para encontrar el ID)
  dump-console.js         # vuelca la consola en vivo para calibrar los regex
deploy/palworld-bot.service  # unit file de systemd
```
