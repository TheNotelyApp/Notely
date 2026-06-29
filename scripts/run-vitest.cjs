const { spawn } = require("node:child_process");

const vitestEntrypoint = require.resolve("vitest/vitest.mjs");
const args = process.argv.slice(2);

const child = spawn(process.execPath, [vitestEntrypoint, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_CJS_IGNORE_WARNING: "true",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(typeof code === "number" ? code : 1);
});
