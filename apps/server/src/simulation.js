import { SERVER_CONFIG } from "./constants.js";

export function createSimulation(onSnapshot) {
  let lastTick = Date.now();

  function tick() {
    const now = Date.now();
    const delta = now - lastTick;
    if (delta >= SERVER_CONFIG.tickMs) {
      lastTick = now;
      // TODO: advance game state and emit snapshot
      onSnapshot({ type: "snapshot", now });
    }
  }

  setInterval(tick, SERVER_CONFIG.tickMs / 2);

  return {
    queueInput() {
      // TODO: enqueue inputs
    }
  };
}
