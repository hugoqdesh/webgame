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
    clients.set(socket, { id: null });

    socket.on("message", (data) => {
      handleMessage({ socket, data, clients, simulation });
    });

    socket.on("close", () => {
      clients.delete(socket);
    });
  }

  return { handleConnection };
}
