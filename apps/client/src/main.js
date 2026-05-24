import { connect } from "./network.js";
import { initInput } from "./input.js";
import { render } from "./renderer.js";
import { getInputState } from "./input.js";

//connect();
initInput();
function loop() {
    requestAnimationFrame(loop);
    getInputState();
    console.log(getInputState());
    render();
}
loop();

