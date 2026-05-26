const pressedKey = {
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

export function initInput() {
  // Capture local intent only; server remains the source of truth.
  addEventListener("keydown", (event) => {
    if (!allowedKeys.has(event.key)) return;
    pressedKey[event.key] = true;
  });

  addEventListener("keyup", (event) => {
    if (!allowedKeys.has(event.key)) return;
    pressedKey[event.key] = false;
  });
}

export function getInputState() {
  // Normalize to a tiny payload for network efficiency.
  return {
    left: pressedKey.ArrowLeft || pressedKey.a,
    right: pressedKey.ArrowRight || pressedKey.d,
    up: pressedKey.ArrowUp || pressedKey.w,
    down: pressedKey.ArrowDown || pressedKey.s,
  };
}
