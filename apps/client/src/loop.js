import { render } from "./renderer.js";

export function startLoop() {
  const step = () => {
    render();
    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}
