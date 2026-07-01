const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const sourcePath = path.join(projectRoot, "app-version.json");
const outputPath = path.join(projectRoot, "electron", "app-version.generated.json");

function runGit(args) {
  return spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}

function resolveCommitHash() {
  const refs = ["master", "origin/master", "HEAD"];
  for (const ref of refs) {
    const result = runGit(["rev-parse", "--short=8", ref]);
    if (result.status === 0) {
      const hash = String(result.stdout || "").trim();
      if (hash) return hash;
    }
  }
  return "nogit";
}

function parseVersionSource() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error("app-version.json is missing.");
  }

  const parsed = JSON.parse(String(fs.readFileSync(sourcePath, "utf8") || "{}"));
  const major = Number(parsed.major);
  const minor = Number(parsed.minor);
  const patch = Number(parsed.patch);

  if (!Number.isInteger(major) || major < 0) throw new Error("major must be a non-negative integer.");
  if (!Number.isInteger(minor) || minor < 0) throw new Error("minor must be a non-negative integer.");
  if (!Number.isInteger(patch) || patch < 0) throw new Error("patch must be a non-negative integer.");

  return { major, minor, patch };
}

function main() {
  const base = parseVersionSource();
  const versionCore = `${base.major}.${base.minor}.${base.patch}`;
  const commitHash = resolveCommitHash();
  const version = `${versionCore}-${commitHash}`;

  const payload = {
    version,
    versionCore,
    major: base.major,
    minor: base.minor,
    patch: base.patch,
    commitHash,
    source: "app-version.json",
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`[version] ${version}\n`);
}

main();
