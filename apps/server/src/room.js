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

  function handleConnection(socket) {
    const playerId = simulation.assignPlayer();
    if (!playerId) {
      socket.close(1008, "Room full");
      return;
    }

    clients.set(socket, { id: playerId });
    socket.send(JSON.stringify({ type: "welcome", playerId }));

    socket.on("message", (data) => {
      handleMessage({ socket, data, clients, simulation });
    });

    socket.on("close", () => {
      const client = clients.get(socket);
      if (client && client.id) {
        simulation.removePlayer(client.id);
      }
      clients.delete(socket);
    });
  }

  return { handleConnection };
}
