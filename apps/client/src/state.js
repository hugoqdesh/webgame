// Client-side view of the game world received from the server.
// Rendering reads this state; gameplay writes happen on the server.
export const clientState = {
  playerId: null,
  name: null,
  isLead: false,
  phase: "lobby",
  players: {},
  snapshotId: null,
  lobbyPlayers: [],
  canStart: false,
  error: null,
};
