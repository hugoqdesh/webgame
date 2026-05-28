import { SERVER_CONFIG } from "./constants.js";
import { state } from "./state.js";

const PLAYER_SPEED = 15;
const NAME_MAX = 12;
const NAME_MIN = 1;
const DEFAULT_LIVES = 5;
const DEFAULT_HEALTH = 100;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(name) {
  if (!name) return "";
  return String(name).trim().slice(0, NAME_MAX);
}

function buildSnapshot(snapshotId, ts) {
  // Keep snapshots small and stable; clients use these for rendering only.
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
      health: player.health,
      lives: player.lives,
      score: player.score,
      eliminated: player.eliminated,
    };
  }

  const remainingMs = getTimerRemainingMs(ts);

  return {
    type: "snapshot",
    snapshotId,
    ts,
    phase: state.phase,
    timerMs: remainingMs,
    winner: state.winner,
    notification: state.notification,
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

function getTimerRemainingMs(now) {
  if (state.phase === "lobby") {
    return state.timer.durationMs;
  }
  if (state.phase === "ended") {
    return 0;
  }
  if (state.phase === "paused" && state.timer.pausedAt) {
    const pausedElapsed =
      state.timer.pausedAt - state.timer.startedAt - state.timer.pausedTotalMs;
    return Math.max(0, state.timer.durationMs - pausedElapsed);
  }
  const startedAt = state.timer.startedAt;
  if (!startedAt) {
    return state.timer.durationMs;
  }
  const pausedTotal = state.timer.pausedTotalMs;
  const elapsed = now - startedAt - pausedTotal;
  const remaining = state.timer.durationMs - elapsed;
  return Math.max(0, remaining);
}

function resetPlayer(player) {
  player.health = DEFAULT_HEALTH;
  player.lives = DEFAULT_LIVES;
  player.score = 0;
  player.eliminated = false;
  player.input = { left: false, right: false, up: false, down: false };
}

function selectWinner() {
  const activePlayers = getActivePlayers();
  if (activePlayers.length === 0) return null;
  let best = activePlayers[0];
  for (const player of activePlayers) {
    if (player.score > best.score) {
      best = player;
    }
  }
  return {
    id: best.id,
    name: best.name,
    score: best.score,
  };
}

export function createSimulation(onSnapshot) {
  let lastTick = Date.now();
  let lastSnapshotAt = 0;
  let snapshotId = 0;
  let snapshotDirty = true;
  let lastTimerSecond = null;

  function handlePlayerDeparture(playerId, reason) {
    // Centralize disconnect/quit handling so snapshots stay consistent.
    const player = state.players[playerId];
    if (!player || !player.active) {
      return { error: "Player not active" };
    }

    const playerName = player.name || "Player";
    player.active = false;
    player.name = null;
    player.isLead = false;
    resetPlayer(player);
    ensureLead();

    if (reason === "quit") {
      state.notification = `${playerName} quit the game`;
    } else if (reason === "disconnect") {
      state.notification = `${playerName} disconnected`;
    }

    const activePlayers = getActivePlayers();
    // If too few players remain mid-game, end safely and pick a winner.
    if (
      (state.phase === "running" || state.phase === "paused") &&
      activePlayers.length < 2
    ) {
      state.phase = "ended";
      state.winner = selectWinner();
      if (!state.winner) {
        state.notification = "Game ended";
      }
    }

    snapshotDirty = true;
    return { phase: state.phase };
  }

  function updatePlayers() {
    // Server-authoritative movement: clients send intent only.
    if (state.phase !== "running") return false;
    let moved = false;
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

      const nextX = clamp(player.x + dx, 0, state.world.width - player.size);
      const nextY = clamp(player.y + dy, 0, state.world.height - player.size);
      if (nextX !== player.x || nextY !== player.y) {
        moved = true;
      }
      player.x = nextX;
      player.y = nextY;
    }
    return moved;
  }

  function tick() {
    const now = Date.now();
    const delta = now - lastTick;
    if (delta >= SERVER_CONFIG.tickMs) {
      lastTick = now;
      if (updatePlayers()) {
        snapshotDirty = true;
      }
      if (state.phase === "running") {
        const remainingMs = getTimerRemainingMs(now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        if (remainingSeconds !== lastTimerSecond) {
          lastTimerSecond = remainingSeconds;
          snapshotDirty = true;
        }
        if (remainingMs <= 0) {
          state.phase = "ended";
          state.winner = selectWinner();
          state.notification = "Game ended";
          snapshotDirty = true;
        }
      }
      if (snapshotDirty && now - lastSnapshotAt >= SERVER_CONFIG.snapshotMs) {
        // Throttle snapshots to avoid redundant bandwidth and client work.
        snapshotId += 1;
        onSnapshot(buildSnapshot(snapshotId, now));
        lastSnapshotAt = now;
        snapshotDirty = false;
      }
    }
  }

  setInterval(tick, SERVER_CONFIG.tickMs / 2);

  return {
    getLobbyState() {
      // Lobby state is derived server-side to keep all clients consistent.
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
      // Enforce unique names and capacity before a player is activated.
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
          resetPlayer(player);
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
      // Disconnects can happen anytime; treat them like a safe quit.
      handlePlayerDeparture(playerId, "disconnect");
    },
    pauseGame(requesterId) {
      if (state.phase !== "running") {
        return { error: "Game is not running" };
      }
      const requester = state.players[requesterId];
      if (!requester || !requester.active) {
        return { error: "Player not active" };
      }
      state.phase = "paused";
      state.timer.pausedAt = Date.now();
      state.notification = `${requester.name} paused the game`;
      snapshotDirty = true;
      return { paused: true };
    },
    resumeGame(requesterId) {
      if (state.phase !== "paused") {
        return { error: "Game is not paused" };
      }
      const requester = state.players[requesterId];
      if (!requester || !requester.active) {
        return { error: "Player not active" };
      }
      if (state.timer.pausedAt) {
        state.timer.pausedTotalMs += Date.now() - state.timer.pausedAt;
        state.timer.pausedAt = null;
      }
      state.phase = "running";
      state.notification = `${requester.name} resumed the game`;
      snapshotDirty = true;
      return { resumed: true };
    },
    quitPlayer(requesterId) {
      // Explicit quit uses the same cleanup path as disconnects.
      const result = handlePlayerDeparture(requesterId, "quit");
      if (result.error) return result;
      return { quit: true, phase: result.phase };
    },
    startGame(requesterId) {
      // Only lead player can start; this prevents race conditions.
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
      state.timer.startedAt = Date.now();
      state.timer.pausedAt = null;
      state.timer.pausedTotalMs = 0;
      state.winner = null;
      state.notification = null;
      lastTimerSecond = null;
      snapshotDirty = true;
      return { started: true };
    },
    queueInput(playerId, input) {
      // Inputs are accepted only while running to keep simulation deterministic.
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
