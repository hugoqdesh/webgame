import { SERVER_CONFIG } from "./constants.js";
import { state } from "./state.js";

const PLAYER_SPEED = 3;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildSnapshot() {
  const players = {};
  for (const id in state.players) {
    const player = state.players[id];
    players[id] = {
      id: player.id,
      x: player.x,
      y: player.y,
      size: player.size,
      active: player.active,
    };
  }

  return {
    type: "snapshot",
    players,
  };
}

export function createSimulation(onSnapshot) {
  let lastTick = Date.now();

  function updatePlayers() {
    for (const id in state.players) {
      const player = state.players[id];
      if (!player.active) continue;

      const input = player.input;
      let dx = 0;
      let dy = 0;

      if (input.left) dx -= PLAYER_SPEED;
      if (input.right) dx += PLAYER_SPEED;
      if (input.up) dy -= PLAYER_SPEED;
      if (input.down) dy += PLAYER_SPEED;

      player.x = clamp(player.x + dx, 0, state.world.width - player.size);
      player.y = clamp(player.y + dy, 0, state.world.height - player.size);
    }
  }

  function tick() {
    const now = Date.now();
    const delta = now - lastTick;
    if (delta >= SERVER_CONFIG.tickMs) {
      lastTick = now;
      updatePlayers();
      onSnapshot(buildSnapshot());
    }
  }

  setInterval(tick, SERVER_CONFIG.tickMs / 2);

  return {
    assignPlayer() {
      for (const id in state.players) {
        const player = state.players[id];
        if (!player.active) {
          player.active = true;
          player.input = { left: false, right: false, up: false, down: false };
          return player.id;
        }
      }
      return null;
    },
    removePlayer(playerId) {
      const player = state.players[playerId];
      if (!player) return;
      player.active = false;
      player.input = { left: false, right: false, up: false, down: false };
    },
    queueInput(playerId, input) {
      const player = state.players[playerId];
      if (!player || !player.active) return;
      player.input = {
        left: !!input.left,
        right: !!input.right,
        up: !!input.up,
        down: !!input.down,
      };
    },
  };
}
