import { defineConfig } from 'vitest/config';

import { resolve } from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: { 
    globals: true,
    environment: 'node',  // Default: node (fast). jsdom only where needed via @vitest-environment
    setupFiles: [resolve(__dirname, '../tests/setup.ts')],
    // CSS testing support
    css: {
      modules: {
        classNameStrategy: 'stable'
      }
    },
    // Test patterns
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/unit/styles/**/*.{test,spec}.{js,ts}',
      'tests/integration/css/**/*.{test,spec}.{js,ts}',
      'tests/integration/performance/**/*.{test,spec}.{js,ts}'
    ]
  }
});