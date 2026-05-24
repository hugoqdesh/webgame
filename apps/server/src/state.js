import { GAME_CONFIG } from "../../../packages/shared/src/config.js";

const PLAYER_SIZE = 32;

export const state = {
  world: {
    width: GAME_CONFIG.arenaWidth,
    height: GAME_CONFIG.arenaHeight,
  },

  projectiles: [],

  timer: {
    durationMs: 180000,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
  },

  phase: "lobby",

  players: {
    player1: {
      id: "player1",
      name: "Player 1",
      active: false,
      health: 100,
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
      name: "Player 2",
      active: false,
      health: 100,
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
      name: "Player 3",
      active: false,
      health: 100,
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
      name: "Player 4",
      active: false,
      health: 100,
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