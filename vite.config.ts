import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devServerPort = Number(env.VITE_DEV_SERVER_PORT || 5173);
  const hmrClientPort = Number(env.VITE_HMR_CLIENT_PORT || devServerPort);
  const hmrHost = env.VITE_HMR_HOST || 'localhost';
  const usePolling =
    env.CHOKIDAR_USEPOLLING === 'true' ||
    env.CHOKIDAR_USEPOLLING === '1' ||
    env.VITE_USE_POLLING === 'true' ||
    env.VITE_USE_POLLING === '1';
  const shelluiRoot = path.resolve(process.env.SHELLUI_ROOT ?? path.join(__dirname, '../shellui'));

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Import core ContentView without installing @shellui/core (workspace:* sdk breaks outside monorepo).
        '@shellui/core/ContentView': path.resolve(
          shelluiRoot,
          'packages/core/src/components/ContentView.tsx',
        ),
        '@shellui/core/types': path.resolve(
          shelluiRoot,
          'packages/core/src/features/config/types.ts',
        ),
      },
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', '@shellui/sdk'],
    },
    base: '/',
    server: {
      host: true,
      port: devServerPort,
      strictPort: true,
      origin: `http://localhost:${devServerPort}`,
      cors: true,
      watch: {
        usePolling,
      },
      hmr: {
        clientPort: hmrClientPort,
        host: hmrHost,
        protocol: 'ws',
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
