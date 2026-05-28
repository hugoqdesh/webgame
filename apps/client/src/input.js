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

let lastAim = { x: 1, y: 0 };
let shootQueued = false;

const allowedKeys = new Set([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	"a",
	"d",
	"w",
	"s",
	" ",
]);

export function initInput() {
	// Capture local intent only; server remains the source of truth.
	addEventListener("keydown", (event) => {
		if (!allowedKeys.has(event.key)) return;
		if (event.key === " ") {
			event.preventDefault();
			if (!pressedKey[event.key]) {
				shootQueued = true;
			}
		}
		pressedKey[event.key] = true;
	});

	addEventListener("keyup", (event) => {
		if (!allowedKeys.has(event.key)) return;
		pressedKey[event.key] = false;
	});
}

export function getInputState() {
	// Normalize to a tiny payload for network efficiency.
	const input = {
		left: pressedKey.ArrowLeft || pressedKey.a,
		right: pressedKey.ArrowRight || pressedKey.d,
		up: pressedKey.ArrowUp || pressedKey.w,
		down: pressedKey.ArrowDown || pressedKey.s,
	};

	let x = 0;
	let y = 0;
	if (input.left) x -= 1;
	if (input.right) x += 1;
	if (input.up) y -= 1;
	if (input.down) y += 1;
	if (x !== 0 || y !== 0) {
		const length = Math.hypot(x, y);
		lastAim = { x: x / length, y: y / length };
	}

	return input;
}

export function consumeShootAction() {
	if (!shootQueued) return null;
	shootQueued = false;
	return {
		directionX: lastAim.x,
		directionY: lastAim.y,
	};
}
