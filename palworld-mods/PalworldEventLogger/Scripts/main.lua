-- PalworldEventLogger
-- Escribe eventos del juego a UE4SS.log con un prefijo fijo
-- ([EVENTLOG] ...) para que el bot de Discord (que tailea ese archivo via
-- la API de Dathost) los detecte y clasifique. No manda nada por HTTP
-- directo porque UE4SS/Lua no trae libreria de red.
--
-- Chat: hook verificado contra una fuente real y publica
-- (https://gist.github.com/xrandox/46bff6611a7e115b1f780928e83b40c3).
--
-- Captura: encontrada por prueba y error en el server real, dumpeando
-- funciones/parametros con ForEachFunction/ForEachProperty (APIs reales de
-- UE4SS, sin GUI/dumper interactivo). PalCaptureSuccess(AttackerPlayer,
-- Monster) confirmado en vivo: dispara con el jugador y el Pal capturado.
--
-- Muerte de jugador: pendiente. Los candidatos probados (ProcessDeadAction,
-- los delegates CapturePalDelegate/KillPalDelegate) no dispararon ni con
-- una muerte de jugador ni con la muerte de un Pal -- ademas confirmamos
-- que los hooks sobre "*__DelegateSignature" no disparan nunca via
-- RegisterHook (son solo la firma de tipo del delegate, no el punto real
-- donde se invoca). Falta dumpear la clase del personaje (PalPlayerCharacter
-- o similar) para encontrar el hook real.

RegisterHook("/Script/Pal.PalGameStateInGame:BroadcastChatMessage", function(self, ChatMessage)
  local ok, err = pcall(function()
    local chat_message = ChatMessage:get()
    local sender = chat_message.Sender:ToString()
    local message = chat_message.Message:ToString()
    print(string.format("[EVENTLOG] CHAT|%s|%s\n", sender, message))
  end)
  if not ok then
    print(string.format("[EVENTLOG] ERROR|chat hook: %s\n", tostring(err)))
  end
end)

RegisterHook("/Script/Pal.PalUtility:PalCaptureSuccess", function(Context, AttackerPlayer, Monster)
  local ok, err = pcall(function()
    local player = AttackerPlayer:get()
    local monster = Monster:get()

    local playerName = "Alguien"
    local playerActorName = "?"
    pcall(function()
      playerActorName = player:GetFullName()
    end)

    local psOk, playerState = pcall(function()
      return player.PlayerState
    end)
    if not psOk then
      print(string.format("[EVENTLOG] NAMEDEBUG|PlayerState pcall fallo|actor=%s|err=%s\n", playerActorName, tostring(playerState)))
    elseif not playerState then
      print(string.format("[EVENTLOG] NAMEDEBUG|PlayerState es nil|actor=%s\n", playerActorName))
    else
      local nameOk, name = pcall(function()
        local n = playerState:GetPlayerName()
        local sOk, s = pcall(function()
          return n:ToString()
        end)
        if sOk then
          return s
        end
        return n
      end)
      if nameOk and name then
        playerName = tostring(name)
      else
        print(string.format("[EVENTLOG] NAMEDEBUG|GetPlayerName fallo|actor=%s|err=%s\n", playerActorName, tostring(name)))
      end
    end

    local codename = "un Pal"
    local fnOk, fullName = pcall(function()
      return monster:GetFullName()
    end)
    if fnOk and fullName then
      local className = tostring(fullName):match("^(%S+)")
      codename = (className and className:match("^BP_(.+)_C$")) or className or codename
    end

    print(string.format("[EVENTLOG] CAPTURE|%s|%s\n", playerName, codename))
  end)
  if not ok then
    print(string.format("[EVENTLOG] ERROR|capture hook: %s\n", tostring(err)))
  end
end)

print("[EVENTLOG] READY|PalworldEventLogger cargado\n")
