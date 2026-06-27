#!/usr/bin/env node
/**
 * Generates THIRD_PARTY_NOTICES.txt by scanning the installed dependency tree.
 *
 * For every package reachable from the project's runtime + dev dependencies,
 * it records the package name, version, declared license, author/homepage, and
 * the verbatim text of any bundled LICENSE file. This keeps attribution
 * accurate (read from node_modules) rather than hand-maintained.
 *
 * Usage: node scripts/generate-notices.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const OUTPUT = path.join(ROOT, 'THIRD_PARTY_NOTICES.txt');

const LICENSE_FILE_NAMES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'license',
  'license.md',
  'LICENCE',
  'LICENCE.md',
  'COPYING',
  'COPYING.md'
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) {
    return pkg.license.type;
  }
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => (typeof l === 'string' ? l : l.type)).filter(Boolean).join(', ');
  }
  return 'UNKNOWN';
}

function normalizeAuthor(pkg) {
  if (typeof pkg.author === 'string') return pkg.author;
  if (pkg.author && typeof pkg.author === 'object') {
    return [pkg.author.name, pkg.author.email && `<${pkg.author.email}>`].filter(Boolean).join(' ');
  }
  return '';
}

function findLicenseText(pkgDir) {
  for (const name of LICENSE_FILE_NAMES) {
    const candidate = path.join(pkgDir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      try {
        return fs.readFileSync(candidate, 'utf8').trim();
      } catch {
        return '';
      }
    }
  }
  return '';
}

/**
 * Resolve a package directory by name, honoring scoped packages.
 */
function resolvePkgDir(name) {
  const dir = path.join(NODE_MODULES, ...name.split('/'));
  return fs.existsSync(path.join(dir, 'package.json')) ? dir : null;
}

function collect() {
  const rootPkg = readJson(path.join(ROOT, 'package.json')) || {};
  // Only runtime dependencies are distributed with the packaged app; dev
  // dependencies (build/test tooling) are intentionally excluded.
  const seeds = Object.keys({
    ...(rootPkg.dependencies || {}),
    ...(rootPkg.optionalDependencies || {})
  });

  const visited = new Set();
  const queue = [...seeds];
  const packages = [];

  while (queue.length) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);

    const dir = resolvePkgDir(name);
    if (!dir) continue;

    const pkg = readJson(path.join(dir, 'package.json'));
    if (!pkg) continue;

    packages.push({
      name: pkg.name || name,
      version: pkg.version || '',
      license: normalizeLicense(pkg),
      author: normalizeAuthor(pkg),
      homepage: pkg.homepage || (pkg.repository && (pkg.repository.url || pkg.repository)) || '',
      licenseText: findLicenseText(dir)
    });

    for (const dep of Object.keys(pkg.dependencies || {})) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  packages.sort((a, b) => a.name.localeCompare(b.name));
  return packages;
}

function render(packages) {
  const lines = [];
  lines.push('THIRD-PARTY SOFTWARE NOTICES AND INFORMATION');
  lines.push('');
  lines.push('Notely incorporates components from the projects listed below.');
  lines.push(`This file was generated automatically on ${new Date().toISOString().slice(0, 10)} by`);
  lines.push('scripts/generate-notices.cjs. Do not edit by hand.');
  lines.push('');
  lines.push(`Total third-party packages: ${packages.length}`);
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('');

  for (const pkg of packages) {
    lines.push(`${pkg.name}@${pkg.version}`);
    if (pkg.license) lines.push(`License: ${pkg.license}`);
    if (pkg.author) lines.push(`Author: ${pkg.author}`);
    if (pkg.homepage) lines.push(`Homepage: ${String(pkg.homepage).replace(/^git\+/, '')}`);
    lines.push('');
    if (pkg.licenseText) {
      lines.push(pkg.licenseText);
      lines.push('');
    }
    lines.push('-'.repeat(80));
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(NODE_MODULES)) {
    console.error('[generate-notices] node_modules not found; run npm install first.');
    process.exit(1);
  }
  const packages = collect();
  fs.writeFileSync(OUTPUT, render(packages), 'utf8');
  console.log(`[generate-notices] Wrote ${packages.length} package notices to ${path.relative(ROOT, OUTPUT)}`);
}

main();
