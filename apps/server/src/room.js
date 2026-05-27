import { handleMessage } from "./messages.js";
import { createSimulation } from "./simulation.js";

export function createRoom() {
  const clients = new Map();
  const simulation = createSimulation((snapshot) => {
    broadcast(JSON.stringify(snapshot));
  });

  function broadcast(payload) {
    // Broadcast keeps clients in sync; gameplay still lives on the server.
    for (const socket of clients.keys()) {
      if (socket.readyState === 1) {
        socket.send(payload);
      }
    }
  }

  function broadcastLobby() {
    broadcast(JSON.stringify(simulation.getLobbyState()));
  }

  function handleConnection(socket) {
    // Connections join the lobby first; player slots are assigned on join.
    clients.set(socket, { id: null, name: null });
    socket.send(JSON.stringify(simulation.getLobbyState()));

    socket.on("message", (data) => {
      handleMessage({ socket, data, clients, simulation, broadcast });
    });

    socket.on("close", () => {
      // Close events are treated as disconnects; snapshots handle in-game updates.
      const client = clients.get(socket);
      if (client && client.id) {
        simulation.removePlayer(client.id);
      }
      clients.delete(socket);
      if (simulation.getLobbyState().phase === "lobby") {
        broadcastLobby();
      }
    });
  }

  return { handleConnection };
}
