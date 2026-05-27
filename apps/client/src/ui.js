import { clientState } from "./state.js";

const timerEl = document.getElementById("timer");
const scoreboardEl = document.getElementById("scoreboard");
const notificationsEl = document.getElementById("notifications");

let lastHudKey = null;

function formatTimer(ms) {
  if (ms == null) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function updateHud() {
  const players = Object.values(clientState.players || {}).filter(
    (player) => player && player.active,
  );
  const winner = clientState.winner;
  const hudKey = [
    clientState.phase,
    clientState.timerMs,
    winner ? `${winner.id}:${winner.score}` : "",
    players
      .map(
        (player) =>
          `${player.id}:${player.name}:${player.score}:${player.lives}:${player.health}:${player.eliminated ? "1" : "0"}`,
      )
      .join(","),
  ].join("|");

  if (hudKey === lastHudKey) {
    return;
  }
  lastHudKey = hudKey;

  timerEl.textContent = formatTimer(clientState.timerMs);
  scoreboardEl.innerHTML = players
    .map((player) => {
      const status = player.eliminated ? "OUT" : "IN";
      return `${player.name} | ${status} | Score: ${player.score} | Lives: ${player.lives} | HP: ${player.health}`;
    })
    .join("<br>");

  if (clientState.phase === "ended" && winner) {
    notificationsEl.textContent = `Winner: ${winner.name} (${winner.score})`;
  } else if (clientState.phase === "ended") {
    notificationsEl.textContent = "Game ended";
  } else {
    notificationsEl.textContent = "";
  }
}
