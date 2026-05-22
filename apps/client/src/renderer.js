import { state } from "./state";

export function render() {
  for (const id in state.players) {
    const player = state.players[id];
    let playerElement = document.getElementById("players");
    if (!playerElement) {
      playerElement = document.createElement("div");
      playerElement.id = player.id;
      playerElement.appendChild(playerElement);
      //not working, WIP
    }
  }
}
