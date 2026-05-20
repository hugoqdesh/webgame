export const initialState = {
  phase: "lobby",
  players: {},
  projectiles: [],
  timer: {
    durationMs: 180000,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0
  }
};
