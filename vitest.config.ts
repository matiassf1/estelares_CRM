import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./src/test-setup.ts'],
    // Los *.int.test.ts requieren PostgreSQL real: corren con vitest.int.config.ts
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.test.ts'],
  },
});
