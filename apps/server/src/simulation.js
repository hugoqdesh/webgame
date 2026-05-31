import { SERVER_CONFIG } from "./constants.js";
import { GAME_CONFIG } from "../../../packages/shared/src/config.js";
import { state } from "./state.js";

const PLAYER_SPEED = 8;
const NAME_MAX = 12;
const NAME_MIN = 1;
const DEFAULT_LIVES = 5;
const DEFAULT_HEALTH = 100;
const PROJECTILE_TTL_MS = 5000;
const PLAYER_SPAWNS = {
  player1: { x: 120, y: 120 },
  player2: { x: 748, y: 120 },
  player3: { x: 120, y: 448 },
  player4: { x: 748, y: 448 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const WALLS = GAME_CONFIG.walls || [];
const PU = GAME_CONFIG.powerup;

function hitsWall(x, y, w, h) {
  for (const wall of WALLS) {
    if (
      x < wall.x + wall.w &&
      x + w > wall.x &&
      y < wall.y + wall.h &&
      y + h > wall.y
    ) {
      return true;
    }
  }
  return false;
}

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function hasEffect(player, type) {
  return player.effects && player.effects[type] > Date.now();
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
      effects: activeEffects(player, ts),
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
    powerups: state.powerups.map((p) => ({
      id: p.id,
      type: p.type,
      x: p.x,
      y: p.y,
      size: p.size,
    })),
  };
}

function activeEffects(player, now) {
  if (!player.effects) return [];
  return PU.types.filter((type) => player.effects[type] > now);
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

function resetPlayer(player, options = {}) {
  if (options.resetPosition) {
    const spawn = PLAYER_SPAWNS[player.id];
    if (spawn) {
      player.x = spawn.x;
      player.y = spawn.y;
    }
  }
  player.health = DEFAULT_HEALTH;
  player.lives = DEFAULT_LIVES;
  player.score = 0;
  player.eliminated = false;
  player.aimX = player.x < state.world.width / 2 ? 1 : -1;
  player.aimY = 0;
  player.lastShotAt = 0;
  player.effects = {};
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
  let nextPowerupId = 1;
  let lastPowerupSpawn = 0;

  function canPlayRound() {
    const activePlayers = getActivePlayers();
    return (
      // currently starts with 1 player for testing simplicity.
      activePlayers.length >= 1 &&
      activePlayers.length <= GAME_CONFIG.maxPlayers
    );
  }

  function resetRound(now) {
    // A round reset is server-owned so clients cannot preserve stale combat state.
    for (const player of getActivePlayers()) {
      resetPlayer(player, { resetPosition: true });
    }
    state.timer.startedAt = now;
    state.timer.pausedAt = null;
    state.timer.pausedTotalMs = 0;
    state.projectiles = [];
    state.powerups = [];
    state.winner = null;
    state.notification = null;
    state.phase = "running";
    lastTimerSecond = null;
    nextProjectileId = 1;
    nextPowerupId = 1;
    lastPowerupSpawn = now;
    snapshotDirty = true;
  }

  function endGame(notification = "Game ended") {
    state.phase = "ended";
    state.winner = selectWinner();
    state.notification = notification;
    state.projectiles = [];
    state.powerups = [];
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
    resetPlayer(player, { resetPosition: true });
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

    if (getActivePlayers().length === 0) {
      state.phase = "lobby";
      state.winner = null;
      state.notification = null;
      state.projectiles = [];
      state.powerups = [];
      state.timer.startedAt = null;
      state.timer.pausedAt = null;
      state.timer.pausedTotalMs = 0;
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
      const speed = hasEffect(player, "speed")
        ? PLAYER_SPEED * PU.speedMultiplier
        : PLAYER_SPEED;
      let dx = 0;
      let dy = 0;

      if (input.left) dx -= speed;
      if (input.right) dx += speed;
      if (input.up) dy -= speed;
      if (input.down) dy += speed;

      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        player.aimX = dx / length;
        player.aimY = dy / length;
      }

      const nextX = clamp(player.x + dx, 0, state.world.width - player.size);
      const nextY = clamp(player.y + dy, 0, state.world.height - player.size);
      const canPass =
        hasEffect(player, "ghost") ||
        hitsWall(player.x, player.y, player.size, player.size);
      let resolvedX = player.x;
      let resolvedY = player.y;
      if (canPass || !hitsWall(nextX, resolvedY, player.size, player.size)) {
        resolvedX = nextX;
      }
      if (canPass || !hitsWall(resolvedX, nextY, player.size, player.size)) {
        resolvedY = nextY;
      }
      if (resolvedX !== player.x || resolvedY !== player.y) {
        moved = true;
      }
      player.x = resolvedX;
      player.y = resolvedY;
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
      let hitSomeone = false;

      projectile.x += projectile.vx;
      projectile.y += projectile.vy;

      const activePlayers = getActiveCombatants();

      for (const player of activePlayers) {
        if (player.id === projectile.ownerId) continue;

        const hit =
          projectile.x < player.x + player.size &&
          projectile.x + projectile.size > player.x &&
          projectile.y < player.y + player.size &&
          projectile.y + projectile.size > player.y;

        if (hit) {
          hitSomeone = true;
          const shooter = state.players[projectile.ownerId];
          if (shooter) shooter.score += 1;
          player.health -= 50;

          if (player.health <= 0) {
            player.lives -= 1;
            player.health = DEFAULT_HEALTH;
          }
          if (player.lives <= 0) {
            player.eliminated = true;
            if (shooter) shooter.score += 3;
          }
          break;
        }
      }
      const expired = now - projectile.createdAt > projectile.ttlMs;
      const outside =
        projectile.x < -projectile.size ||
        projectile.y < -projectile.size ||
        projectile.x > state.world.width ||
        projectile.y > state.world.height;
      const blocked = hitsWall(
        projectile.x,
        projectile.y,
        projectile.size,
        projectile.size,
      );

      if (!hitSomeone && !expired && !outside && !blocked) {
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

  function spawnPowerup(now) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = 40 + Math.random() * (state.world.width - 80 - PU.size);
      const y = 40 + Math.random() * (state.world.height - 80 - PU.size);
      if (hitsWall(x, y, PU.size, PU.size)) continue;
      const onPlayer = getActiveCombatants().some((p) =>
        aabb(x, y, PU.size, PU.size, p.x, p.y, p.size, p.size),
      );
      if (onPlayer) continue;
      const type = PU.types[Math.floor(Math.random() * PU.types.length)];
      state.powerups.push({ id: `pu-${nextPowerupId++}`, type, x, y, size: PU.size });
      return true;
    }
    return false;
  }

  function updatePowerups(now) {
    if (state.phase !== "running") return false;
    let changed = false;

    for (const id in state.players) {
      const effects = state.players[id].effects;
      for (const type in effects) {
        if (effects[type] <= now) {
          delete effects[type];
          changed = true;
        }
      }
    }

    if (
      state.powerups.length < PU.maxActive &&
      now - lastPowerupSpawn >= PU.spawnIntervalMs
    ) {
      lastPowerupSpawn = now;
      if (spawnPowerup(now)) changed = true;
    }

    const remaining = [];
    for (const pu of state.powerups) {
      let taken = false;
      for (const player of getActiveCombatants()) {
        if (aabb(pu.x, pu.y, pu.size, pu.size, player.x, player.y, player.size, player.size)) {
          player.effects[pu.type] = now + PU.durationMs;
          taken = true;
          break;
        }
      }
      if (taken) changed = true;
      else remaining.push(pu);
    }
    state.powerups = remaining;
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
      if (updatePowerups(now)) {
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
        canStart: canPlayRound(),
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
      if (state.phase === "running" || state.phase === "paused") {
        return { error: "Game already started" };
      }

      const normalized = normalizeName(name);
      if (normalized.length < NAME_MIN) {
        return { error: "Name is required" };
      }

      const activePlayers = getActivePlayers();
      if (activePlayers.length >= GAME_CONFIG.maxPlayers) {
        return { error: "Room full" };
      }

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
          resetPlayer(player, { resetPosition: true });
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
        for (const id in state.players) {
          const effects = state.players[id].effects;
          for (const type in effects) {
            effects[type] += pausedMs;
          }
        }
        lastPowerupSpawn += pausedMs;
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
      if (
        activePlayers.length < 1 ||
        activePlayers.length > GAME_CONFIG.maxPlayers
      ) {
        return { error: "Need 1-4 players" };
      }

      resetRound(Date.now());
      return { started: true };
    },
    restartGame(requesterId) {
      // Restart is intentionally limited to ended games and the current lead.
      if (state.phase !== "ended") {
        return { error: "Game has not ended" };
      }
      const requester = state.players[requesterId];
      if (!requester || !requester.active || !requester.isLead) {
        return { error: "Only the lead player can restart" };
      }

      const activePlayers = getActivePlayers();
      if (
        activePlayers.length < 1 ||
        activePlayers.length > GAME_CONFIG.maxPlayers
      ) {
        return { error: "Need 1-4 players to restart" };
      }

      resetRound(Date.now());
      return { restarted: true };
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

      const bulletSpeed = hasEffect(player, "bullet")
        ? GAME_CONFIG.projectileSpeed * PU.bulletMultiplier
        : GAME_CONFIG.projectileSpeed;

      state.projectiles.push({
        id: `projectile-${nextProjectileId}`,
        ownerId: player.id,
        x: player.x + player.size / 2 - GAME_CONFIG.projectileSize / 2,
        y: player.y + player.size / 2 - GAME_CONFIG.projectileSize / 2,
        vx: directionX * bulletSpeed,
        vy: directionY * bulletSpeed,
        size: GAME_CONFIG.projectileSize,
        createdAt: now,
        ttlMs: PROJECTILE_TTL_MS,
      });
      nextProjectileId += 1;
      snapshotDirty = true;
    },
  };
}
