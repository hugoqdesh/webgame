import { SERVER_CONFIG } from "./constants.js";
import { GAME_CONFIG } from "../../../packages/shared/src/config.js";
import { state } from "./state.js";

const PLAYER_SPEED = 15;
const NAME_MAX = 12;
const NAME_MIN = 1;
const DEFAULT_LIVES = 5;
const DEFAULT_HEALTH = 100;
const PROJECTILE_TTL_MS = 1500;

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
  const projectiles = state.projectiles
    .filter((projectile) => state.players[projectile.ownerId]?.active)
    .map((projectile) => ({
      id: projectile.id,
      ownerId: projectile.ownerId,
      x: projectile.x,
      y: projectile.y,
      size: projectile.size,
    }));

  return {
    type: "snapshot",
    snapshotId,
    ts,
    phase: state.phase,
    timerMs: remainingMs,
    winner: state.winner,
    notification: state.notification,
    players,
    projectiles,
  };
}

function getActivePlayers() {
  return Object.values(state.players).filter((player) => player.active);
}

function getActiveCombatants() {
  return getActivePlayers().filter((player) => !player.eliminated);
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
  player.aimX = player.x < state.world.width / 2 ? 1 : -1;
  player.aimY = 0;
  player.lastShotAt = 0;
  player.input = { left: false, right: false, up: false, down: false };
}

function removeProjectilesOwnedBy(playerId) {
  const previousCount = state.projectiles.length;
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.ownerId !== playerId,
  );
  return state.projectiles.length !== previousCount;
}

function selectWinner() {
  const candidates = getActiveCombatants();
  const activePlayers = candidates.length > 0 ? candidates : getActivePlayers();
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
  let nextProjectileId = 1;

  function endGame(notification = "Game ended") {
    state.phase = "ended";
    state.winner = selectWinner();
    state.notification = notification;
    state.projectiles = [];
    snapshotDirty = true;
  }

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
    removeProjectilesOwnedBy(playerId);
    ensureLead();

    if (reason === "quit") {
      state.notification = `${playerName} quit the game`;
    } else if (reason === "disconnect") {
      state.notification = `${playerName} disconnected`;
    }

    const activePlayers = getActiveCombatants();
    // If too few players remain mid-game, end safely and pick a winner.
    if (
      (state.phase === "running" || state.phase === "paused") &&
      activePlayers.length < 2
    ) {
      endGame(state.notification || "Game ended");
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
      if (!player.active || player.eliminated) continue;

      const input = player.input;
      let dx = 0;
      let dy = 0;

      if (input.left) dx -= PLAYER_SPEED;
      if (input.right) dx += PLAYER_SPEED;
      if (input.up) dy -= PLAYER_SPEED;
      if (input.down) dy += PLAYER_SPEED;

      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        player.aimX = dx / length;
        player.aimY = dy / length;
      }

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

  function updateProjectiles(now) {
    if (state.phase !== "running") return false;

    let changed = false;
    const activeProjectiles = [];
    for (const projectile of state.projectiles) {
      if (!state.players[projectile.ownerId]?.active) {
        changed = true;
        continue;
      }

      projectile.x += projectile.vx;
      projectile.y += projectile.vy;

      const expired = now - projectile.createdAt > projectile.ttlMs;
      const outside =
        projectile.x < -projectile.size ||
        projectile.y < -projectile.size ||
        projectile.x > state.world.width ||
        projectile.y > state.world.height;

      if (!expired && !outside) {
        activeProjectiles.push(projectile);
      } else {
        changed = true;
      }
    }

    if (state.projectiles.length > 0) {
      changed = true;
    }
    state.projectiles = activeProjectiles;
    return changed;
  }

  function tick() {
    const now = Date.now();
    const delta = now - lastTick;
    if (delta >= SERVER_CONFIG.tickMs) {
      lastTick = now;
      if (updatePlayers()) {
        snapshotDirty = true;
      }
      if (updateProjectiles(now)) {
        snapshotDirty = true;
      }
      if (state.phase === "running") {
        const remainingMs = getTimerRemainingMs(now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const activeCombatants = getActiveCombatants();
        if (activeCombatants.length < 2) {
          endGame("Game ended");
        }
        if (remainingSeconds !== lastTimerSecond) {
          lastTimerSecond = remainingSeconds;
          snapshotDirty = true;
        }
        if (remainingMs <= 0) {
          endGame("Game ended");
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
        //currently starts with 1 player for testing simplicity.
        canStart: activePlayers.length >= 1,
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
      if (!requester || !requester.active || requester.eliminated) {
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
      if (!requester || !requester.active || requester.eliminated) {
        return { error: "Player not active" };
      }
      if (state.timer.pausedAt) {
        const pausedMs = Date.now() - state.timer.pausedAt;
        state.timer.pausedTotalMs += pausedMs;
        state.timer.pausedAt = null;
        for (const projectile of state.projectiles) {
          projectile.createdAt += pausedMs;
        }
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
      if (activePlayers.length < 1) {
        return { error: "Need at least 2 players" };
      }

      state.phase = "running";
      state.timer.startedAt = Date.now();
      state.timer.pausedAt = null;
      state.timer.pausedTotalMs = 0;
      state.projectiles = [];
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
      if (!player || !player.active || player.eliminated) return;
      player.input = {
        left: !!input.left,
        right: !!input.right,
        up: !!input.up,
        down: !!input.down,
      };
    },
    shoot(playerId, payload = {}) {
      if (state.phase !== "running") return;
      const player = state.players[playerId];
      if (!player || !player.active || player.eliminated) return;

      const now = Date.now();
      if (now - player.lastShotAt < GAME_CONFIG.shootCooldownMs) return;

      const requestedX = Number(payload.directionX);
      const requestedY = Number(payload.directionY);
      let directionX = player.aimX;
      let directionY = player.aimY;
      if (Number.isFinite(requestedX) && Number.isFinite(requestedY)) {
        const requestedLength = Math.hypot(requestedX, requestedY);
        if (requestedLength <= 0 || requestedLength > 100) return;
        directionX = requestedX;
        directionY = requestedY;
      }
      const length = Math.hypot(directionX, directionY);
      if (length <= 0) return;
      directionX /= length;
      directionY /= length;

      player.aimX = directionX;
      player.aimY = directionY;
      player.lastShotAt = now;

      state.projectiles.push({
        id: `projectile-${nextProjectileId}`,
        ownerId: player.id,
        x: player.x + player.size / 2 - GAME_CONFIG.projectileSize / 2,
        y: player.y + player.size / 2 - GAME_CONFIG.projectileSize / 2,
        vx: directionX * GAME_CONFIG.projectileSpeed,
        vy: directionY * GAME_CONFIG.projectileSpeed,
        size: GAME_CONFIG.projectileSize,
        createdAt: now,
        ttlMs: PROJECTILE_TTL_MS,
      });
      nextProjectileId += 1;
      snapshotDirty = true;
    },
  };
}
