let ctx = null;

export function initAudio() {
	if (ctx) return;
	addEventListener(
		"click",
		() => {
			ctx = new (window.AudioContext || window.webkitAudioContext)();
			ctx.resume();
		},
		{ once: true },
	);
}

const SOUNDS = {
	shoot: { freq: 660, dur: 0.08, type: "square" },
	hit: { freq: 320, dur: 0.1, type: "sawtooth" },
	death: { freq: 160, dur: 0.3, type: "triangle" },
	start: { freq: 520, dur: 0.2, type: "sine" },
	over: { freq: 240, dur: 0.5, type: "sine" },
	powerup: { freq: 880, dur: 0.15, type: "triangle" },
};

export function playSound(type) {
	const sound = SOUNDS[type];
	if (!ctx || !sound) return;

	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = sound.type;
	osc.frequency.value = sound.freq;

	const now = ctx.currentTime;
	gain.gain.setValueAtTime(0.2, now);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.dur);

	osc.connect(gain).connect(ctx.destination);
	osc.start(now);
	osc.stop(now + sound.dur);
}
