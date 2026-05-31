import { connect } from "./network.js";
import { initInput, getInputState, consumeShootAction } from "./input.js";
import { render } from "./renderer.js";
import { clientState } from "./state.js";
import { updateHud } from "./ui.js";
import { initAudio, playSound } from "./audio.js";

const socket = connect();
initInput();
initAudio();

let lastSent = 0;
let lastInput = null;

function inputsEqual(a, b) {
	return (
		a.left === b.left &&
		a.right === b.right &&
		a.up === b.up &&
		a.down === b.down
	);
}

const lobbyEl = document.getElementById("lobby");
const gameEl = document.getElementById("game");
const joinForm = document.getElementById("join-form");
const nameInput = document.getElementById("player-name");
const joinSubmit = joinForm.querySelector("button[type=submit]");
const joinError = document.getElementById("join-error");
const lobbyList = document.getElementById("lobby-players");
const lobbyStatus = document.getElementById("lobby-status");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const resumeButton = document.getElementById("resume-button");
const quitButton = document.getElementById("quit-button");
let lastLobbyKey = null;
let lastRenderedSnapshotId = null;

function updateJoinForm() {
	const joined = !!clientState.playerId;
	const ready = socket.readyState === WebSocket.OPEN;
	nameInput.disabled = joined;
	joinSubmit.disabled = joined || !ready;
	joinSubmit.textContent = joined ? "joined" : ready ? "join" : "…";
}

function lobbyStatusText() {
	if (!clientState.playerId) return "";
	if (!clientState.canStart) return "waiting for players…";
	if (clientState.isLead) return "ready — click start";
	return "waiting for lead to start…";
}

function updateLobbyUI() {
	if (clientState.phase !== "lobby") {
		lobbyEl.classList.add("hidden");
		gameEl.classList.remove("hidden");
	} else {
		lobbyEl.classList.remove("hidden");
		gameEl.classList.add("hidden");
	}

	joinError.textContent = clientState.error || "";
	lobbyStatus.textContent = lobbyStatusText();

	// Avoid rebuilding lobby DOM if nothing relevant changed.
	const lobbyKey = [
		clientState.phase,
		clientState.canStart ? "1" : "0",
		clientState.isLead ? "1" : "0",
		clientState.lobbyPlayers
			.map(
				(player) => `${player.id}:${player.name}:${player.isLead ? "1" : "0"}`,
			)
			.join(","),
	].join("|");

	if (lobbyKey === lastLobbyKey) {
		return;
	}
	lastLobbyKey = lobbyKey;

	lobbyList.innerHTML = "";

	for (const player of clientState.lobbyPlayers) {
		const item = document.createElement("div");
		item.className = "lobby-player";
		item.textContent = player.isLead ? `${player.name} (lead)` : player.name;
		lobbyList.appendChild(item);
	}

	startButton.hidden = !clientState.isLead;
	startButton.disabled = !clientState.canStart;
}

joinForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const name = nameInput.value.trim();
	if (!name) {
		clientState.error = "Enter a name.";
		updateLobbyUI();
		return;
	}
	if (socket.readyState === WebSocket.OPEN) {
		// Send a single join request; server validates uniqueness and capacity.
		socket.send(JSON.stringify({ type: "join", payload: { name } }));
	}
});

startButton.addEventListener("click", () => {
	if (socket.readyState === WebSocket.OPEN) {
		// Only the lead player is allowed to start the match.
		socket.send(JSON.stringify({ type: "start" }));
	}
});

pauseButton.addEventListener("click", () => {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: "pause" }));
	}
});

resumeButton.addEventListener("click", () => {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: "resume" }));
	}
});

function sendQuit() {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: "quit" }));
	}
	clientState.playerId = null;
	clientState.name = null;
	clientState.isLead = false;
	clientState.phase = "lobby";
	clientState.winner = null;
	updateLobbyUI();
	updateJoinForm();
}

quitButton.addEventListener("click", sendQuit);

document.getElementById("overlay-resume").addEventListener("click", () => {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: "resume" }));
	}
});

document.getElementById("overlay-quit").addEventListener("click", sendQuit);

document.getElementById("play-again").addEventListener("click", () => {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: "restart" }));
	}
});

window.addEventListener("lobby:update", updateLobbyUI);
window.addEventListener("phase:update", updateLobbyUI);

updateLobbyUI();
updateJoinForm();

nameInput.addEventListener("input", () => {
	if (clientState.error) {
		clientState.error = null;
		joinError.textContent = "";
	}
});

socket.addEventListener("open", updateJoinForm);
socket.addEventListener("close", updateJoinForm);
window.addEventListener("lobby:update", updateJoinForm);

function loop() {
	if (clientState.phase !== "lobby") {
		// Render only when a new snapshot arrives to reduce DOM churn.
		if (clientState.snapshotId !== lastRenderedSnapshotId) {
			render();
			updateHud();
			lastRenderedSnapshotId = clientState.snapshotId;
		}
	}

	const now = performance.now();
	const input = getInputState();
	const shootAction = consumeShootAction();
	if (clientState.phase === "running" && socket.readyState === WebSocket.OPEN) {
		// Throttle input sends; only transmit on change or after a short interval.
		if (!lastInput || !inputsEqual(lastInput, input) || now - lastSent > 100) {
			socket.send(JSON.stringify({ type: "input", payload: input }));
			lastSent = now;
			lastInput = { ...input };
		}
		if (shootAction) {
			socket.send(JSON.stringify({ type: "shoot", payload: shootAction }));
			playSound("shoot");
		}
	}

	requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
