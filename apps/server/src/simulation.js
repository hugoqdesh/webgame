import { SERVER_CONFIG } from "./constants.js";
import { state } from "./state.js";

const PLAYER_SPEED = 3;
const NAME_MAX = 12;
const NAME_MIN = 1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name) {
  if (!name) return "";
  return String(name).trim().slice(0, NAME_MAX);
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
      name: player.name,
    };
  }

  return {
    type: "snapshot",
    phase: state.phase,
    players,
  };
}

function getActivePlayers() {
  return Object.values(state.players).filter((player) => player.active);
}

function ensureLead() {
  const activePlayers = getActivePlayers();
  const currentLead = activePlayers.find((player) => player.isLead);
  if (currentLead) return currentLead.id;
  if (activePlayers.length === 0) return null;
  activePlayers[0].isLead = true;
  return activePlayers[0].id;
}

export function createSimulation(onSnapshot) {
  let lastTick = Date.now();

  function updatePlayers() {
    if (state.phase !== "running") return;
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
    getLobbyState() {
      const activePlayers = getActivePlayers();
      const leadId = ensureLead();
      return {
        type: "lobby",
        phase: state.phase,
        canStart: activePlayers.length >= 2,
        leadId,
        players: activePlayers.map((player) => ({
          id: player.id,
          name: player.name,
          isLead: player.id === leadId,
        })),
      };
    },
    assignPlayer(name) {
      if (state.phase !== "lobby") {
        return { error: "Game already started" };
      }

      const normalized = normalizeName(name);
      if (normalized.length < NAME_MIN) {
        return { error: "Name is required" };
      }

      const activePlayers = getActivePlayers();
      const duplicate = activePlayers.find(
        (player) =>
          player.name && player.name.toLowerCase() === normalized.toLowerCase(),
      );
      if (duplicate) {
        return { error: "Name already taken" };
      }

      for (const id in state.players) {
        const player = state.players[id];
        if (!player.active) {
          player.active = true;
          player.name = normalized;
          player.isLead = false;
          player.input = { left: false, right: false, up: false, down: false };
          const leadId = ensureLead();
          return {
            playerId: player.id,
            isLead: player.id === leadId,
            name: player.name,
          };
        }
      }

      return { error: "Room full" };
    },
    removePlayer(playerId) {
      const player = state.players[playerId];
      if (!player) return;
      player.active = false;
      player.name = null;
      player.isLead = false;
      player.input = { left: false, right: false, up: false, down: false };
      ensureLead();
    },
    startGame(requesterId) {
      if (state.phase !== "lobby") {
        return { error: "Game already started" };
      }
      const requester = state.players[requesterId];
      if (!requester || !requester.active || !requester.isLead) {
        return { error: "Only the lead player can start" };
      }

      const activePlayers = getActivePlayers();
      if (activePlayers.length < 2) {
        return { error: "Need at least 2 players" };
      }

      state.phase = "running";
      return { started: true };
    },
    queueInput(playerId, input) {
      if (state.phase !== "running") return;
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
