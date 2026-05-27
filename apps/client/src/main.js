import { connect } from "./network.js";
import { initInput, getInputState } from "./input.js";
import { render } from "./renderer.js";
import { clientState } from "./state.js";
import { updateHud } from "./ui.js";

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
const joinError = document.getElementById("join-error");
const lobbyList = document.getElementById("lobby-players");
const startButton = document.getElementById("start-button");
let lastLobbyKey = null;
let lastRenderedSnapshotId = null;

function updateLobbyUI() {
  // Avoid rebuilding lobby DOM if nothing relevant changed.
  const lobbyKey = [
    clientState.phase,
    clientState.error || "",
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

  if (clientState.phase === "running") {
    lobbyEl.classList.add("hidden");
    gameEl.classList.remove("hidden");
  } else {
    lobbyEl.classList.remove("hidden");
    gameEl.classList.add("hidden");
  }

  joinError.textContent = clientState.error || "";
  lobbyList.innerHTML = "";

  for (const player of clientState.lobbyPlayers) {
    const item = document.createElement("div");
    item.className = "lobby-player";
    item.textContent = player.isLead ? `${player.name} (lead)` : player.name;
    lobbyList.appendChild(item);
  }

  const canStart = clientState.canStart && clientState.isLead;
  startButton.disabled = !canStart;
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

function loop() {
  if (clientState.phase === "running") {
    // Render only when a new snapshot arrives to reduce DOM churn.
    if (clientState.snapshotId !== lastRenderedSnapshotId) {
      render();
      updateHud();
      lastRenderedSnapshotId = clientState.snapshotId;
    }
  } else if (clientState.phase === "ended") {
    updateHud();
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
