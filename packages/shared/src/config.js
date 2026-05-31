export const GAME_CONFIG = {
	arenaWidth: 900,
	arenaHeight: 600,
	maxPlayers: 4,
	projectileSpeed: 15,
	projectileSize: 15,
	shootCooldownMs: 250,

	// Obstacles
	walls: [
		{ x: 415, y: 265, w: 70, h: 70 },
		{ x: 420, y: 96, w: 60, h: 18 },
		{ x: 420, y: 486, w: 60, h: 18 },
		{ x: 96, y: 270, w: 18, h: 60 },
		{ x: 786, y: 270, w: 18, h: 60 },
		{ x: 210, y: 205, w: 70, h: 18 },
		{ x: 620, y: 205, w: 70, h: 18 },
		{ x: 210, y: 377, w: 70, h: 18 },
		{ x: 620, y: 377, w: 70, h: 18 },
	],
};
