import { connect } from "./network.js";
import { startLoop } from "./loop.js";
import { initInput } from "./input.js";

connect();
initInput();
startLoop();
