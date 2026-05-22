import { state } from "./state.js";

export function initInput() {
  // TODO: capture keyboard input and send to server
  addEventListener("keydown", (event) => {
    const myPlayer = state.players.player1;
    switch (event.key) {
      case "ArrowRight":
        myPlayer.vx = 2;
        break;
      case "ArrowLeft":
        myPlayer.vx = -2;
        break;
      case "ArrowUp":
        myPlayer.vy = 2;
        break;
      case "ArrowDown":
        myPlayer.vy = -2;
        break;
    }
  });

  addEventListener("keyup", (event) => {
    const myPlayer = state.players.player1;
    switch (event.key) {
      case "ArrowRight":
        myPlayer.vx = 0;
        break;
      case "ArrowLeft":
        myPlayer.vx = 0;
        break;
      case "ArrowUp":
        myPlayer.vy = 0;
        break;
      case "ArrowDown":
        myPlayer.vy = 0;
        break;
    }
  });
}
