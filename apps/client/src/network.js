import { clientState } from "./state.js";

export function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.hostname}:8080`;
  // Separate socket per browser tab; server remains authoritative.
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.log("Connected to game server", url);
  });

  socket.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      // Lobby and phase messages drive UI; snapshots drive rendering.
      if (msg.type === "welcome") {
        clientState.playerId = msg.playerId;
        clientState.name = msg.name || null;
        clientState.isLead = !!msg.isLead;
        window.dispatchEvent(new CustomEvent("lobby:update"));
        return;
      }
      if (msg.type === "lobby") {
        clientState.phase = msg.phase || clientState.phase;
        clientState.lobbyPlayers = msg.players || [];
        clientState.canStart = !!msg.canStart;
        if (msg.leadId && clientState.playerId) {
          clientState.isLead = msg.leadId === clientState.playerId;
        }
        clientState.error = null;
        window.dispatchEvent(new CustomEvent("lobby:update"));
        return;
      }
      if (msg.type === "phase") {
        clientState.phase = msg.phase || clientState.phase;
        window.dispatchEvent(new CustomEvent("phase:update"));
        return;
      }
      if (msg.type === "error") {
        clientState.error = msg.message || "Unknown error";
        window.dispatchEvent(new CustomEvent("lobby:update"));
        return;
      }
      if (msg.type === "snapshot" && msg.players) {
        // Ignore duplicate snapshots to avoid redundant work.
        if (msg.snapshotId === clientState.snapshotId) {
          return;
        }
        clientState.snapshotId = msg.snapshotId ?? clientState.snapshotId;
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
