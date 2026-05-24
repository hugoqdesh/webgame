
import { state } from "./state.js"

function update() {
  for (const id in state.players) {
    const player = state.players[id];
    //update position of players by adding velocity to position.
    player.x += player.vx;
    player.y += player.vy;
  }
}
function loop() {
  update();
  requestAnimationFrame(loop);
}

export function startLoop() {
  requestAnimationFrame(loop);
}
