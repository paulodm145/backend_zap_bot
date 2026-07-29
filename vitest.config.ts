import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // As integrações compartilham o banco central e fazem limpeza entre cenários.
    // Arquivos paralelos poderiam remover registros usados por outra suíte.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/servidor.ts', 'src/types/**/*.d.ts'],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
