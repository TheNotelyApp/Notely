const { spawn } = require("node:child_process");
const electron = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (process.argv.includes("--dev")) {
  env.ELECTRON_RENDERER_URL = "http://127.0.0.1:5173";
} else {
  delete env.ELECTRON_RENDERER_URL;
}

const child = spawn(electron, ["."], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: false
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
