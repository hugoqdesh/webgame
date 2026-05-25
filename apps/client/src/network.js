import { clientState } from "./state.js";

export function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.hostname}:8080`;
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.log("Connected to game server", url);
  });

  socket.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "welcome") {
        clientState.playerId = msg.playerId;
        return;
      }
      if (msg.type === "snapshot" && msg.players) {
        clientState.players = msg.players;
      }
    } catch {
      console.warn("Non-JSON ws message", ev.data);
    }
  });

  socket.addEventListener("close", () => {
    console.log("Disconnected from game server");
  });

  socket.addEventListener("error", (err) => {
    console.error("WebSocket error", err);
  });

  return socket;
}
