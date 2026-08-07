-- PalworldEventLogger
-- Escribe eventos del juego a la consola del server con un prefijo fijo
-- ([EVENTLOG] ...) para que el bot de Discord (que ya lee la consola via
-- la API de Dathost) los detecte y clasifique. No manda nada por HTTP
-- directo porque UE4SS/Lua no trae libreria de red.
--
-- Hook de chat verificado contra una fuente real y publica:
-- https://gist.github.com/xrandox/46bff6611a7e115b1f780928e83b40c3
-- (RegisterHook para /Script/Pal.PalGameStateInGame:BroadcastChatMessage,
-- struct FPalChatMessage con campos Sender/Message confirmados).
--
-- Muertes y capturas de Pals NO estan incluidas todavia: no hay nombres de
-- funcion confirmados para esos eventos (se necesita correr el dumper de
-- UE4SS contra el server para encontrarlos). Se agregan en una iteracion
-- aparte cuando esten confirmados.

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

print("[EVENTLOG] READY|PalworldEventLogger cargado\n")
