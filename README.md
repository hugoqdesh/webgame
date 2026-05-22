# Multi-Player DOM Arena Shooter

Monorepo layout:

- apps/client: Vanilla JS DOM-only client
- apps/server: Node.js + ws server
- packages/shared: Shared protocol + config

Dev scripts:

- "dev": "vite apps/client --port 5173",
- "dev:client": "vite apps/client --port 5173",
- "dev:server": "node apps/server/src/index.js",
- "dev:all": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
  