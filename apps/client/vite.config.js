import { resolve } from 'path';

/**
 * Vite config for the client app.
 * - Proxies `/ws` to the backend WebSocket server at :8080
 * - Adds an alias `@shared` to import shared code from the monorepo
 * - Allows the dev server to serve files from the shared package
 */
export default {
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    },
    fs: {
      // Allow serving files from the client directory and the shared package
      allow: [resolve(__dirname), resolve(__dirname, '../../packages/shared')]
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src')
    }
  },
  base: '/'
};
