import { defineConfig } from 'vitest/config';

// Tests de integración contra PostgreSQL real. Separados de los unitarios
// (vitest.config.ts) porque aquéllos mockean pool.query, y las reglas temporales
// de membresía —EXCLUDE, transacciones, FOR UPDATE, la vista de estado— son
// comportamientos de la base que un mock no puede verificar.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/**/*.int.test.ts'],
    setupFiles: ['./src/test-int-setup.ts'],
    globalSetup: ['./src/test-int-global.ts'],
    // Las transiciones compiten por las mismas filas: una sola worker evita
    // falsos positivos de concurrencia entre archivos distintos.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
