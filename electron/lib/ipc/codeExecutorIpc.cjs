const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { assertTrustedIpcSender } = require("./ipcSecurity.cjs");

function registerCodeExecutorIpcHandlers(ipcMain, deps) {
  const { BrowserWindow } = deps;

  ipcMain.handle("code:execute", async (event, payload) => {
    assertTrustedIpcSender(BrowserWindow, event, "code:execute");

    const { language, code } = payload || {};
    if (!language || typeof code !== "string") {
      throw new Error("Invalid execution payload: language and code are required.");
    }

    const normLang = language.toLowerCase();
    if (normLang !== "javascript" && normLang !== "js" && normLang !== "python" && normLang !== "py") {
      throw new Error(`Unsupported execution language: ${language}`);
    }

    // Write code to a temp file to run it
    const tempDir = os.tmpdir();
    const fileExt = (normLang === "python" || normLang === "py") ? ".py" : ".js";
    const tempFile = path.join(tempDir, `notely-exec-${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`);

    try {
      fs.writeFileSync(tempFile, code, "utf8");
    } catch (err) {
      return {
        success: false,
        stdout: "",
        stderr: `Failed to create temporary script file: ${err.message}`,
        exitCode: -1
      };
    }

    return new Promise((resolve) => {
      let command = "node";
      let args = [tempFile];

      if (normLang === "python" || normLang === "py") {
        // Default to python, but fallback to python3 if not Windows (common in unix/macos setups)
        command = process.platform === "win32" ? "python" : "python3";
        args = [tempFile];
      }

      let stdoutData = "";
      let stderrData = "";
      let child;

      try {
        child = spawn(command, args);
      } catch (spawnError) {
        // If python/python3 is not installed or command not found
        cleanupTempFile(tempFile);
        resolve({
          success: false,
          stdout: "",
          stderr: `Failed to spawn executable process (${command}): ${spawnError.message}`,
          exitCode: -1
        });
        return;
      }

      // Handle spawn errors that happen asynchronously (e.g. command not found)
      child.on("error", (err) => {
        cleanupTempFile(tempFile);
        resolve({
          success: false,
          stdout: stdoutData,
          stderr: stderrData + `\nProcess error: ${err.message}\nEnsure '${command}' is installed and in your system PATH.`,
          exitCode: -1
        });
      });

      child.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      // Set execution timeout (10 seconds)
      const timeoutLimit = 10000;
      const timer = setTimeout(() => {
        if (child && !child.killed) {
          try {
            child.kill("SIGKILL");
          } catch {
            // Ignore kill errors
          }
          cleanupTempFile(tempFile);
          resolve({
            success: false,
            stdout: stdoutData,
            stderr: stderrData + `\n[Execution Timeout] The script was terminated because it exceeded the ${timeoutLimit / 1000}-second limit.`,
            exitCode: -1
          });
        }
      }, timeoutLimit);

      child.on("close", (code) => {
        clearTimeout(timer);
        cleanupTempFile(tempFile);
        resolve({
          success: code === 0,
          stdout: stdoutData,
          stderr: stderrData,
          exitCode: code
        });
      });
    });
  });
}

function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[CodeExecutor] Failed to clean up temp file ${filePath}:`, err.message);
  }
}

module.exports = {
  registerCodeExecutorIpcHandlers
};
