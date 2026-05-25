import { clientState } from "./state.js";

const playerElements = {};
const container = document.getElementById("players");

export function render() {
  const activeIds = new Set();

  for (const id in clientState.players) {
    const player = clientState.players[id];
    if (!player || !player.active) continue;
    activeIds.add(id);

    if (!playerElements[id]) {
      let playerElement = document.createElement("div");
      playerElement.id = player.id;
      playerElement.classList.add("player");
      if (player.size) {
        playerElement.style.width = `${player.size}px`;
        playerElement.style.height = `${player.size}px`;
      }

      //Save it into our cache
      playerElements[id] = playerElement;

      container.appendChild(playerElement);
    }

    // Now that we guarantee the element exists, we can move it.
    // Using transform: translate() is GPU accelerated and much faster than top/left
    const element = playerElements[id];
    element.style.transform = `translate(${player.x}px, ${player.y}px)`;
  }

  for (const id in playerElements) {
    if (!activeIds.has(id)) {
      playerElements[id].remove();
      delete playerElements[id];
    }
  }
}
