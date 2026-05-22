export function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws`;

  const socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    console.log('Connected to game server', url);
  });

  socket.addEventListener('message', (ev) => {
    // handle incoming messages (JSON expected)
    try {
      const msg = JSON.parse(ev.data);
      console.log('ws msg', msg);
    } catch (e) {
      console.warn('Non-JSON ws message', ev.data);
    }
  });

  socket.addEventListener('close', () => {
    console.log('Disconnected from game server');
  });

  socket.addEventListener('error', (err) => {
    console.error('WebSocket error', err);
  });

  return socket;
}
