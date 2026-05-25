export function handleMessage({ socket, data, clients, simulation }) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  switch (message.type) {
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
