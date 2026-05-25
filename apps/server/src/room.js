import { handleMessage } from "./messages.js";
import { createSimulation } from "./simulation.js";

export function createRoom() {
  const clients = new Map();
  const simulation = createSimulation((snapshot) => {
    broadcast(JSON.stringify(snapshot));
  });

  function broadcast(payload) {
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
    clients.set(socket, { id: null, name: null });
    socket.send(JSON.stringify(simulation.getLobbyState()));

    socket.on("message", (data) => {
      handleMessage({ socket, data, clients, simulation, broadcast });
    });

    socket.on("close", () => {
      const client = clients.get(socket);
      if (client && client.id) {
        simulation.removePlayer(client.id);
      }
      clients.delete(socket);
      broadcastLobby();
    });
  }

  return { handleConnection };
}
