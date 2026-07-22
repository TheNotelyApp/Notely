const path = require("node:path");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");

function getArchName(context) {
  if (context.archName) return context.archName;
  if (typeof context.arch === "string") return context.arch;
  if (typeof context.arch === "number") {
    if (context.arch === 1) return "x64";
    if (context.arch === 3) return "arm64";
    if (context.arch === 0) return "ia32";
  }
  return "x64";
}

/**
 * Prune non-target platform and non-target architecture native binaries from onnxruntime-node.
 */
function pruneUnusedNativeBinaries(appOutDir, platform, archName) {
  const unpackedDir = path.join(appOutDir, "resources", "app.asar.unpacked");
  if (!fs.existsSync(unpackedDir)) return;

  function scanAndPrune(dirPath) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "napi-v6" && fullPath.toLowerCase().includes("onnxruntime-node")) {
          try {
            const osFolders = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const osFolder of osFolders) {
              if (!osFolder.isDirectory()) continue;
              const osPath = path.join(fullPath, osFolder.name);

              if (osFolder.name.toLowerCase() !== platform.toLowerCase()) {
                fs.rmSync(osPath, { recursive: true, force: true });
                console.log(`[afterPack] Pruned non-target OS binaries folder: ${osPath}`);
              } else {
                const archFolders = fs.readdirSync(osPath, { withFileTypes: true });
                for (const archFolder of archFolders) {
                  if (!archFolder.isDirectory()) continue;
                  if (archFolder.name.toLowerCase() !== archName.toLowerCase()) {
                    const archPath = path.join(osPath, archFolder.name);
                    fs.rmSync(archPath, { recursive: true, force: true });
                    console.log(`[afterPack] Pruned non-target arch binaries folder: ${archPath}`);
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`[afterPack] Error pruning ONNX binaries in ${fullPath}:`, err.message);
          }
        } else {
          scanAndPrune(fullPath);
        }
      }
    }
  }

  scanAndPrune(unpackedDir);
}

/**
 * electron-builder afterPack hook.
 * 1. Prunes unused native binaries from app.asar.unpacked.
 * 2. Embeds the Notely icon into Notely.exe using rcedit directly on win32.
 */
module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName || "win32";
  const archName = getArchName(context);

  console.log(`[afterPack] Running pruning hook for platform=${platform}, arch=${archName}...`);

  // 1. Prune unused native binaries
  pruneUnusedNativeBinaries(context.appOutDir, platform, archName);

  // 2. Icon embedding on Windows
  if (platform !== "win32") return;

  const rcEditPath = path.join(
    context.packager.projectDir,
    "node_modules",
    "rcedit",
    "bin",
    "rcedit.exe"
  );

  if (!fs.existsSync(rcEditPath)) {
    console.warn("[afterPack] rcedit.exe not found, skipping icon embed:", rcEditPath);
    return;
  }

  const icoPath = path.join(context.packager.projectDir, "build", "icon.ico");
  if (!fs.existsSync(icoPath)) {
    console.warn("[afterPack] icon.ico not found, skipping icon embed:", icoPath);
    return;
  }

  const appOutDir = context.appOutDir;
  const exeName = `${context.packager.appInfo.productName}.exe`;
  const exePath = path.join(appOutDir, exeName);

  if (!fs.existsSync(exePath)) {
    console.warn("[afterPack] App EXE not found:", exePath);
    return;
  }

  try {
    execFileSync(rcEditPath, [
      exePath,
      "--set-icon", icoPath,
    ], { stdio: "pipe" });
    console.log(`[afterPack] Embedded icon into ${exeName}`);
  } catch (err) {
    console.warn("[afterPack] rcedit failed (icon not embedded):", err.message);
  }
};
