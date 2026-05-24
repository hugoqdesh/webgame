// This is the client's local copy of the game world.
// It starts empty. It will be updated whenever the server sends a network message.
const PLAYER_SIZE = 32;
export const clientState = {
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
  },
};
