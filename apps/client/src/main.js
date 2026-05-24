import { connect } from "./network.js";
import { initInput } from "./input.js";
import { render } from "./renderer.js";
import { getInputState } from "./input.js";
import { clientState } from "./state.js";

//connect();
initInput();
function loop() {
  requestAnimationFrame(loop);
  const inputs = getInputState();
  const player = clientState.players.player1;
  const speed = 3;

  if (inputs.ArrowRight || inputs.d) {
    player.x += speed;
  }
  if (inputs.ArrowLeft || inputs.a) {
    player.x -= speed;
  }
  if (inputs.ArrowUp || inputs.w) {
    player.y -= speed;
  }
  if (inputs.ArrowDown || inputs.s) {
    player.y += speed;
  }
  console.log(getInputState());
  render();
}
loop();
