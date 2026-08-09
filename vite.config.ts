import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Import core ContentView without installing @shellui/core (workspace:* sdk breaks outside monorepo).
      '@shellui/core/ContentView': path.resolve(
        __dirname,
        '../shellui/packages/core/src/components/ContentView.tsx',
      ),
      '@shellui/core/types': path.resolve(
        __dirname,
        '../shellui/packages/core/src/features/config/types.ts',
      ),
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', '@shellui/sdk'],
  },
  base: '/',
  server: {
    port: 5174,
    strictPort: true,
    origin: 'http://localhost:5174',
    cors: true,
    hmr: {
      clientPort: 5174,
      host: 'localhost',
      protocol: 'ws',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
