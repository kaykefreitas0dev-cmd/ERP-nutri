import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: "node",
    poolOptions: {
      threads: {
        singleThread: true, // evita contention RLS em testes paralelos
      },
    },
  },
});
