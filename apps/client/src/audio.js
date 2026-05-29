let ctx = null;

export function initAudio() {
	if (ctx) return;
	addEventListener(
		"click",
		() => {
			ctx = new (window.AudioContext || window.webkitAudioContext)();
		},
		{ once: true },
	);
}
