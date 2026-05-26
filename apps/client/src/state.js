// Client-side view of the game world received from the server.
export const clientState = {
  playerId: null,
  name: null,
  isLead: false,
  phase: "lobby",
  players: {},
  lobbyPlayers: [],
  canStart: false,
  error: null,
};
