import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** @fileoverview Vitest config for the client — jsdom environment for React component tests. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
});
