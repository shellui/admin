import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
