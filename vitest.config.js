import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/tests/**/*.{test,spec}.{js,jsx}", "tests/**/*.{test,spec}.{js,jsx}"],
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    pool: "forks",
    minWorkers: 1,
    maxWorkers: 4,
    isolate: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
