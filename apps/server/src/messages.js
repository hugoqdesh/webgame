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
        // Join flow: validate name and activate player slot.
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
        // Start flow: only lead player can trigger phase change.
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
    case "pause":
      {
        // Pause/resume/quit are server-authoritative; clients only request.
        const client = clients.get(socket);
        if (!client || !client.id) return;
        const result = simulation.pauseGame(client.id);
        if (result.error) {
          socket.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }
      }
      break;
    case "resume":
      {
        const client = clients.get(socket);
        if (!client || !client.id) return;
        const result = simulation.resumeGame(client.id);
        if (result.error) {
          socket.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }
      }
      break;
    case "quit":
      {
        // Quit removes the player; lobby updates only when still in lobby.
        const client = clients.get(socket);
        if (!client || !client.id) return;
        const result = simulation.quitPlayer(client.id);
        if (result.error) {
          socket.send(JSON.stringify({ type: "error", message: result.error }));
          return;
        }
        client.id = null;
        client.name = null;
        if (result.phase === "lobby") {
          broadcast(JSON.stringify(simulation.getLobbyState()));
        }
      }
      break;
    case "input":
      {
        // Inputs are mapped to a player id; clients do not move themselves.
        const client = clients.get(socket);
        if (!client || !client.id) return;
        simulation.queueInput(client.id, message.payload || {});
      }
      break;
    case "shoot":
      {
        // Shooting is an action request; projectile creation remains server-owned.
        const client = clients.get(socket);
        if (!client || !client.id) return;
        simulation.shoot(client.id, message.payload || {});
      }
      break;
    default:
      break;
  }
}
