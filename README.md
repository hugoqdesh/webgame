# Multi-Player Arena Shooter

A real-time, browser-based arena shooter for 2–4 players. Each player joins from
their own browser, moves around a shared arena, shoots opponents, grabs
power-ups, and competes for the highest score before the timer runs out.

Rendering is **DOM-only** (no `<canvas>`). The server is authoritative: clients
send input intent, the server simulates the world and broadcasts snapshots.

## Monorepo layout

- `apps/client` — Vanilla JS, DOM-only client (served with Vite)
- `apps/server` — Node.js + `ws` WebSocket game server (authoritative simulation)
- `packages/shared` — Shared protocol + game config

## Requirements

- Node.js 18+ (the project uses ES modules)
- npm

## Setup

```bash
npm install
```

## Running

Start the server and client together:

```bash
npm run dev:all
```

- Client: http://localhost:5173
- Game server (WebSocket): ws://localhost:8080

Or run them separately:

```bash
npm run dev:server   # WebSocket server on :8080
npm run dev:client   # Vite client on :5173
```

The server port can be changed with the `PORT` env var:

```bash
PORT=9000 npm run dev:server
```

## How to play

1. Open http://localhost:5173 in your browser.
2. Enter a unique name and click **join**.
3. The first player to join is the **lead**. Each other player joins the same
   way from their own browser.
4. When everyone is ready, the lead clicks **start**.
5. Highest score when the timer ends — or the last player standing — wins.

### Controls

| Action       | Keys                                                |
| ------------ | --------------------------------------------------- |
| Move         | Arrow keys or `W A S D`                             |
| Shoot        | `Space` (fires toward your last movement direction) |
| Pause/Resume | Buttons in the top bar                              |
| Quit         | Button in the top bar                               |

### Power-ups

Power-ups spawn randomly and last a few seconds when collected:

- **Speed** (yellow) — faster movement
- **Bullet** (red) — faster projectiles
- **Ghost** (blue) — pass through walls
