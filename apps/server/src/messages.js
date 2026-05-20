export function handleMessage({ socket, data, clients, simulation }) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  switch (message.type) {
    case "input":
      simulation.queueInput(socket, message.payload);
      break;
    default:
      break;
  }
}
