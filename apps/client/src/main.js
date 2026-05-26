import { connect } from "./network.js";
import { initInput, getInputState } from "./input.js";
import { render } from "./renderer.js";
import { clientState } from "./state.js";

const socket = connect();
initInput();

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
	if (clientState.phase === "running") {
		// Render only when a new snapshot arrives to reduce DOM churn.
		if (clientState.snapshotId !== lastRenderedSnapshotId) {
			render();
			lastRenderedSnapshotId = clientState.snapshotId;
		}
	}

	const now = performance.now();
	const input = getInputState();
	if (clientState.phase === "running" && socket.readyState === WebSocket.OPEN) {
		// Throttle input sends; only transmit on change or after a short interval.
		if (!lastInput || !inputsEqual(lastInput, input) || now - lastSent > 100) {
			socket.send(JSON.stringify({ type: "input", payload: input }));
			lastSent = now;
			lastInput = { ...input };
		}
	}

	requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
