let pressedKey = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  a: false,
  d: false,
  w: false,
  s: false,
};

const allowedKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "a",
  "d",
  "w",
  "s",
]);

export function recordInput() {
  // TODO: capture keyboard input and send to server
  addEventListener("keydown", (event) => {
    if (!allowedKeys.has(event.key)) return;
    pressedKey[event.key] = true;
    console.log("key '" + event.key + "' is set to: " + pressedKey[event.key]);
    console.log(pressedKey);
  });

  addEventListener("keyup", (event) => {
    if (!allowedKeys.has(event.key)) return;
    pressedKey[event.key] = false;
    console.log("key '" + event.key + "' is set to: " + pressedKey[event.key]);
    console.log(pressedKey);
  });

  export function getInputState() {
    return allowedKeys;
  }
}
