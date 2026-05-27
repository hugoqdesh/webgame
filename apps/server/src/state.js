import { GAME_CONFIG } from "../../../packages/shared/src/config.js";

const PLAYER_SIZE = 32;

// Server-authoritative state shared by all clients through snapshots.
export const state = {
  world: {
    width: GAME_CONFIG.arenaWidth,
    height: GAME_CONFIG.arenaHeight,
  },

  projectiles: [],

  // Timer is server-owned so all clients see the same countdown.
  timer: {
    durationMs: 180000,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
  },

  // Phase gates simulation and input processing.
  phase: "lobby",

  winner: null,

  players: {
    player1: {
      id: "player1",
      name: null,
      isLead: false,
      active: false,
      health: 100,
      lives: 3,
      score: 0,
      eliminated: false,
      size: PLAYER_SIZE,
      x: 120,
      y: 120,
      input: {
        left: false,
        right: false,
        up: false,
        down: false,
      },
    },

    player2: {
      id: "player2",
      name: null,
      isLead: false,
      active: false,
      health: 100,
      lives: 3,
      score: 0,
      eliminated: false,
      size: PLAYER_SIZE,
      x: 748,
      y: 120,
      input: {
        left: false,
        right: false,
        up: false,
        down: false,
      },
    },

    player3: {
      id: "player3",
      name: null,
      isLead: false,
      active: false,
      health: 100,
      lives: 3,
      score: 0,
      eliminated: false,
      size: PLAYER_SIZE,
      x: 120,
      y: 448,
      input: {
        left: false,
        right: false,
        up: false,
        down: false,
      },
    },

    player4: {
      id: "player4",
      name: null,
      isLead: false,
      active: false,
      health: 100,
      lives: 3,
      score: 0,
      eliminated: false,
      size: PLAYER_SIZE,
      x: 748,
      y: 448,
      input: {
        left: false,
        right: false,
        up: false,
        down: false,
      },
    },
  },
};
