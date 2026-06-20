const { spawn } = require("node:child_process");
const path = require("node:path");
const waitOn = require("wait-on");

const children = new Set();
let shuttingDown = false;

function terminateChildren() {
  for (const child of Array.from(children)) {
    if (!child.killed) {
      child.kill();
    }
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  terminateChildren();

  // Give child processes a moment to receive termination signals.
  setTimeout(() => {
    process.exit(exitCode);
  }, 150);
}

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: "inherit",
    shell: false
  });

  children.add(child);

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${name}:`, error.message);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) return;

    if (name === "electron") {
      shutdown(code ?? 0);
      return;
    }

    if (name === "vite") {
      if (signal) {
        console.error(`[dev] Vite exited due to signal ${signal}.`);
      } else {
        console.error(`[dev] Vite exited with code ${code ?? 1}.`);
      }
      shutdown(code ?? 1);
    }
  });

  return child;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const viteBin = path.join(__dirname, "..", "node_modules", "vite", "bin", "vite.js");
const launchElectronScript = path.join(__dirname, "launch-electron.cjs");

startProcess("vite", process.execPath, [viteBin, "--host", "127.0.0.1"]);

(async () => {
  try {
    await waitOn({
      resources: ["http://127.0.0.1:5173"],
      timeout: 120000,
      interval: 250,
      window: 500
    });

    if (shuttingDown) return;

    startProcess("electron", process.execPath, [launchElectronScript, "--dev"]);
  } catch (error) {
    console.error("[dev] Timed out waiting for Vite at http://127.0.0.1:5173.");
    console.error(`[dev] ${error?.message || "Unknown wait-on error."}`);
    shutdown(1);
  }
})();
