import { connect } from "./network.js";
import { initInput, getInputState } from "./input.js";
import { render } from "./renderer.js";

const socket = connect();
initInput();

let lastSent = 0;
let lastInput = null;

function inputsEqual(a, b) {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.up === b.up &&
    a.down === b.down
  );
}

function loop() {
  render();

  const now = performance.now();
  const input = getInputState();
  if (socket.readyState === WebSocket.OPEN) {
    if (!lastInput || !inputsEqual(lastInput, input) || now - lastSent > 100) {
      socket.send(JSON.stringify({ type: "input", payload: input }));
      lastSent = now;
      lastInput = { ...input };
    }
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
