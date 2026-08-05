import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/tests/**/*.{test,spec}.{js,jsx}", "tests/**/*.{test,spec}.{js,jsx}"],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
