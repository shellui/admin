import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shellui/core/ContentView': path.resolve(__dirname, './src/test/contentViewStub.tsx'),
      // Real core sandbox rules from the sibling shellui checkout (see contentFrameSandbox.spec.ts).
      '@shellui/core/contentIframeSandbox': path.resolve(
        process.env.SHELLUI_ROOT ?? path.join(__dirname, '../shellui'),
        'packages/core/src/components/contentIframeSandbox.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/vitest.setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
