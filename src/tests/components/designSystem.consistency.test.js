import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function collectFiles(rootDir, ext) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(ext)) output.push(full);
    }
  }
  return output;
}

// ─── Suite 1: AppButton variant validity ─────────────────────────────────────
describe("Design System - AppButton variant validity", () => {
  const VALID_VARIANTS = new Set(["primary", "small"]);

  it("uses only valid AppButton variants across all components", () => {
    const files = collectFiles(path.resolve(process.cwd(), "src/components"), ".jsx");
    const offenders = [];
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const buttonRegex = /<AppButton\b([\s\S]*?)>/g;
      let btnMatch;
      while ((btnMatch = buttonRegex.exec(source)) !== null) {
        const props = btnMatch[1];
        const variantMatch = props.match(/\bvariant=["']([^"']+)["']/);
        if (variantMatch && !VALID_VARIANTS.has(variantMatch[1])) {
          const rel = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
          offenders.push(`${rel} variant="${variantMatch[1]}"`);
        }
      }
    }
    expect(offenders, `Invalid AppButton variants found:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ─── Suite 2: Button min-height must use tokens ───────────────────────────────
describe("Design System - Button min-height must use tokens", () => {
  // Known small intentional fixed heights (terminal header, recents chips, etc.)
  const ALLOWED_LITERAL_HEIGHTS = new Set([22, 20, 24]);

  it("no raw px min-height on button selectors in styles.css", () => {
    const css = readSource("src/styles.css");
    const lines = css.split("\n");
    const offenders = [];
    let selectorBuffer = "";
    const buttonSelectorPattern =
      /\.(small-button|primary-button|text-button|icon-button|back-button)\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("{")) selectorBuffer = line;
      else if (line === "" || line === "}") selectorBuffer = "";
      else if (!line.includes("}")) selectorBuffer += " " + line;

      const minHeightMatch = line.match(/min-height:\s*(\d+)px/);
      if (minHeightMatch && buttonSelectorPattern.test(selectorBuffer)) {
        const px = Number(minHeightMatch[1]);
        if (!ALLOWED_LITERAL_HEIGHTS.has(px)) {
          offenders.push(
            `styles.css:${i + 1} min-height:${px}px in button context (use --btn-height-sm or --btn-height-md)`
          );
        }
      }
    }
    expect(offenders, `Raw px min-height in button rules:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ─── Suite 3: Border-radius token scale ──────────────────────────────────────
describe("Design System - Border-radius token scale", () => {
  const ALLOWED_RADIUS_PX = new Set([0, 4, 6, 8, 999]);

  it("all border-radius px values are within the professional token scale [0,4,6,8,999]", () => {
    const cssFiles = [
      "src/styles.css",
      ...collectFiles(path.resolve(process.cwd(), "src/styles"), ".css").map((f) =>
        path.relative(process.cwd(), f).replace(/\\/g, "/")
      ),
    ];
    const offenders = [];

    for (const file of cssFiles) {
      const css = readSource(file);
      const lines = css.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/border-radius:\s*(.+?);/);
        if (!match) continue;
        const value = match[1].trim();
        if (/^(0|50%|var\(--radius-|var\(--detail-topbar|calc\(var\(--radius)/.test(value)) continue;
        for (const pxMatch of [...value.matchAll(/(\d+)px/g)]) {
          const px = Number(pxMatch[1]);
          if (!ALLOWED_RADIUS_PX.has(px)) {
            offenders.push(
              `${file}:${i + 1} border-radius:${value} (${px}px not in scale [0,4,6,8,999])`
            );
          }
        }
      }
    }
    expect(offenders, `Out-of-scale border-radius:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ─── Suite 4: No native title= on icon buttons ───────────────────────────────
describe("Design System - No native title= on icon buttons", () => {
  it("icon buttons use data-tooltip, not the native title= attribute", () => {
    const files = collectFiles(path.resolve(process.cwd(), "src/components"), ".jsx");
    const offenders = [];

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/className[^>]*icon-button/.test(line) && /\btitle=["']/.test(line)) {
          const rel = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
          offenders.push(`${rel}:${i + 1} icon-button with title= (use data-tooltip instead)`);
        }
      }
    }
    expect(offenders, `Icon buttons with native title=:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ─── Suite 5: GlobalTooltip CSS uses design tokens ───────────────────────────
describe("Design System - GlobalTooltip uses CSS tokens", () => {
  it("GlobalTooltip.css references --tooltip-bg and --font-size-label tokens", () => {
    const css = readSource("src/styles/GlobalTooltip.css");
    expect(css, "Missing var(--tooltip-bg)").toMatch(/var\(--tooltip-bg/);
    expect(css, "Missing var(--font-size-label)").toMatch(/var\(--font-size-label\)/);
    expect(css, "Dead variable --bg-tooltip: found").not.toMatch(/--bg-tooltip:/);
    expect(css, "Dead variable --text-tooltip: found").not.toMatch(/--text-tooltip:/);
    expect(css, "Hardcoded font-size: 12px found").not.toMatch(/font-size:\s*12px/);
  });
});

// ─── Suite 6: Dialog button order ────────────────────────────────────────────
describe("Design System - Dialog button ordering", () => {
  it("Cancel button appears before the primary action in ConfirmationProvider", () => {
    const source = readSource("src/components/ConfirmationProvider.jsx");
    const actionsIdx = source.indexOf("confirmation-dialog__actions");
    expect(actionsIdx, "confirmation-dialog__actions not found in ConfirmationProvider").toBeGreaterThan(-1);
    const block = source.slice(actionsIdx);
    const cancelPos = block.search(/cancelLabel|variant="small"/);
    const confirmPos = block.search(/confirmLabel|variant="primary"/);
    expect(cancelPos, "Cancel button must appear before primary action button").toBeLessThan(confirmPos);
  });
});

// ─── Suite 7: mediaPreview.css uses design tokens ────────────────────────────
describe("Design System - mediaPreview uses design tokens", () => {
  it("mediaPreview.css contains no raw hex colors other than media video black", () => {
    const css = readSource("src/styles/mediaPreview.css");
    const matches = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
    const invalidHex = matches.filter((hex) => hex.toLowerCase() !== "#000");
    expect(invalidHex, `Found unexpected raw hex colors in mediaPreview.css: ${invalidHex.join(", ")}`).toEqual([]);
  });

  it("mediaPreview.css references primary design system tokens", () => {
    const css = readSource("src/styles/mediaPreview.css");
    expect(css).toMatch(/var\(--surface-bg\)/);
    expect(css).toMatch(/var\(--border-default\)/);
    expect(css).toMatch(/var\(--text-muted\)/);
    expect(css).toMatch(/var\(--text-strong\)/);
  });
});

// ─── Suite 8: Migrated UI components use ConfirmationProvider, not window.confirm ──
describe("Design System - No native window.confirm in core screens", () => {
  const MIGRATED_FILES = [
    "src/components/TrashDialog.jsx",
    "src/components/MediaPreviewPane.jsx",
    "src/components/AppLogsPage.jsx",
    "src/components/TaskWorkspacePage.jsx",
  ];

  it("migrated components do not invoke native window.confirm", () => {
    const offenders = [];
    for (const relPath of MIGRATED_FILES) {
      const source = readSource(relPath);
      if (source.includes("window.confirm(")) {
        offenders.push(relPath);
      }
    }
    expect(offenders, `Files still using window.confirm: ${offenders.join(", ")}`).toEqual([]);
  });
});

