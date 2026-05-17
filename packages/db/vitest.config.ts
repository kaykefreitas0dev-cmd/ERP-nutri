import { defineConfig } from "vitest/config";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

// Carrega .env do package (DATABASE_URL etc.) antes dos testes rodarem
loadDotenv({ path: resolve(__dirname, ".env") });

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: "node",
    pool: "threads",
    singleThread: true, // evita contention RLS em testes paralelos (vitest 4 top-level)
  },
});
