export function handleMessage({
  socket,
  data,
  clients,
  simulation,
  broadcast,
}) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  switch (message.type) {
    case "join":
      {
        const client = clients.get(socket);
        if (!client) return;
        if (client.id) {
          socket.send(
            JSON.stringify({ type: "error", message: "Already joined" }),
          );
          return;
        }

        const name = message.payload?.name;
        const result = simulation.assignPlayer(name);
        if (result.error) {
          socket.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }

        client.id = result.playerId;
        client.name = result.name;
        socket.send(
          JSON.stringify({
            type: "welcome",
            playerId: result.playerId,
            name: result.name,
            isLead: result.isLead,
          }),
        );
        broadcast(JSON.stringify(simulation.getLobbyState()));
      }
      break;
    case "start":
      {
        const client = clients.get(socket);
        if (!client || !client.id) return;
        const result = simulation.startGame(client.id);
        if (result.error) {
          socket.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }
        broadcast(JSON.stringify({ type: "phase", phase: "running" }));
      }
      break;
    case "input":
      {
        const client = clients.get(socket);
        if (!client || !client.id) return;
        simulation.queueInput(client.id, message.payload || {});
      }
      break;
    default:
      break;
  }
}
