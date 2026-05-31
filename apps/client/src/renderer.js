import { clientState } from "./state.js";
import { GAME_CONFIG } from "../../../packages/shared/src/config.js";

const playerElements = {};
const projectileElements = {};
const powerupElements = {};
const container = document.getElementById("players");
const projectileContainer = document.getElementById("projectiles");
const powerupContainer = document.getElementById("powerups");

const wallContainer = document.getElementById("walls");
for (const wall of GAME_CONFIG.walls || []) {
	const el = document.createElement("div");
	el.className = "wall";
	el.style.width = `${wall.w}px`;
	el.style.height = `${wall.h}px`;
	el.style.transform = `translate(${wall.x}px, ${wall.y}px)`;
	wallContainer.appendChild(el);
}

export function render() {
	// Reuse DOM nodes; only create/remove when players join/leave.
	const activeIds = new Set();

	for (const id in clientState.players) {
		const player = clientState.players[id];
		if (!player || !player.active) continue;
		activeIds.add(id);

		if (!playerElements[id]) {
			let playerElement = document.createElement("div");
			playerElement.id = player.id;
			playerElement.classList.add("player");
			if (player.id === clientState.playerId) {
				playerElement.classList.add("player--self");
			}
			if (player.size) {
				playerElement.style.width = `${player.size}px`;
				playerElement.style.height = `${player.size}px`;
			}
			playerElement.innerHTML = `<div class="hp-bar"><div class="hp-fill"></div></div><span class="lives"></span>`;

			//Save it into our cache
			playerElements[id] = playerElement;

			container.appendChild(playerElement);
		}

		// Now that we guarantee the element exists, we can move it.
		// Using transform: translate() is GPU accelerated and much faster than top/left
		const element = playerElements[id];
		element.style.transform = `translate(${player.x}px, ${player.y}px)`;

		const effects = player.effects || [];
		element.classList.toggle("fx-speed", effects.includes("speed"));
		element.classList.toggle("fx-bullet", effects.includes("bullet"));
		element.classList.toggle("fx-ghost", effects.includes("ghost"));

		const pct = (player.health / 100) * 100;
		const fill = element.querySelector(".hp-fill");
		fill.style.width = `${pct}%`;
		fill.style.background = pct > 50 ? "#4caf50" : pct > 25 ? "#ff9800" : "#f44336";
		element.querySelector(".lives").textContent = player.lives;
	}

	for (const id in playerElements) {
		if (!activeIds.has(id)) {
			playerElements[id].remove();
			delete playerElements[id];
		}
	}

	const activeProjectileIds = new Set();
	for (const projectile of clientState.projectiles || []) {
		if (!projectile) continue;
		activeProjectileIds.add(projectile.id);

		if (!projectileElements[projectile.id]) {
			const projectileElement = document.createElement("div");
			projectileElement.className = "projectile";
			projectileElement.dataset.ownerId = projectile.ownerId || "";
			projectileElements[projectile.id] = projectileElement;
			projectileContainer.appendChild(projectileElement);
		}

		const element = projectileElements[projectile.id];
		if (projectile.size) {
			element.style.width = `${projectile.size}px`;
			element.style.height = `${projectile.size}px`;
		}
		element.style.transform = `translate(${projectile.x}px, ${projectile.y}px)`;
	}

	for (const id in projectileElements) {
		if (!activeProjectileIds.has(id)) {
			projectileElements[id].remove();
			delete projectileElements[id];
		}
	}

	const activePowerupIds = new Set();
	for (const powerup of clientState.powerups || []) {
		if (!powerup) continue;
		activePowerupIds.add(powerup.id);

		if (!powerupElements[powerup.id]) {
			const el = document.createElement("div");
			el.className = `powerup powerup--${powerup.type}`;
			el.style.width = `${powerup.size}px`;
			el.style.height = `${powerup.size}px`;
			powerupElements[powerup.id] = el;
			powerupContainer.appendChild(el);
		}
		powerupElements[powerup.id].style.setProperty("--tx", `${powerup.x}px`);
		powerupElements[powerup.id].style.setProperty("--ty", `${powerup.y}px`);
	}

	for (const id in powerupElements) {
		if (!activePowerupIds.has(id)) {
			const el = powerupElements[id];
			delete powerupElements[id];
			el.classList.add("powerup--collected");
			el.addEventListener("animationend", () => el.remove(), { once: true });
		}
	}
}
