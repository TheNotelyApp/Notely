import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { createMainHelpers } from "../electron/lib/core/mainHelpers.cjs";

const mainHelpers = createMainHelpers({
  fs,
  path,
  ensureDir: () => {},
  getNotesRoot: () => "C:/notes",
  rootProjectSlug: "root",
  shouldHideDirectory: () => false,
  getActiveProjectSlug: () => "root",
  setActiveProjectSlug: () => {},
  hashContent: () => "mock-hash",
});

describe("parseDocument note content and metadata extraction", () => {
  it("preserves # Cleansed and # RawNotes in note content while extracting YAML and key-value metadata", () => {
    const input = `---
Tags: chast, hello
  - guide
  - ai
---
Name: Bikash,Panda,Hari
Time: 10:04, 02 Jul 2026 to 10:04, 07 Jul 2026
Location: Sonepur

# Meeting Notes
Some discussion points here.

# Cleansed
This is the formal cleansed summary.
`;

    const parsed = mainHelpers.parseDocument(input, "C:/notes/test.md");

    expect(parsed.metadata.name).toBe("Bikash,Panda,Hari");
    expect(parsed.metadata.time).toBe("10:04, 02 Jul 2026 to 10:04, 07 Jul 2026");
    expect(parsed.metadata.location).toBe("Sonepur");
    expect(parsed.header).toContain("Tags: chast, hello");
    expect(parsed.header).toContain("Name: Bikash,Panda,Hari");

    // All markdown content except metadata is in rawNotes
    expect(parsed.rawNotes).toContain("# Meeting Notes");
    expect(parsed.rawNotes).toContain("Some discussion points here.");
    expect(parsed.rawNotes).toContain("# Cleansed");
    expect(parsed.rawNotes).toContain("This is the formal cleansed summary.");

    // Cleansed is not artificially split
    expect(parsed.cleansed).toBe("");
  });

  it("handles notes with only key-value metadata at the top", () => {
    const input = `Name: Bikash
Time: 10:00
Location: Office

# Action Items
- Item 1
- Item 2
`;
    const parsed = mainHelpers.parseDocument(input, "C:/notes/kv.md");

    expect(parsed.metadata.name).toBe("Bikash");
    expect(parsed.metadata.time).toBe("10:00");
    expect(parsed.metadata.location).toBe("Office");
    expect(parsed.rawNotes).toBe("# Action Items\n- Item 1\n- Item 2");
  });

  it("handles indented YAML fences and indented metadata lines without leaking them into rawNotes", () => {
    const input = `---
  Tags: chast, hello
    - guide
    - ai
  ---
  Name: Bikash,Panda,Hari
  Time: 10:04, 02 Jul 2026 to 10:04, 07 Jul 2026
  Location: Sonepur

Hello World dddde
# Section 1
Content here
`;
    const parsed = mainHelpers.parseDocument(input, "C:/notes/indented.md");

    expect(parsed.header).toContain("Tags: chast, hello");
    expect(parsed.header).toContain("Name: Bikash,Panda,Hari");
    expect(parsed.rawNotes).not.toContain("Tags:");
    expect(parsed.rawNotes).not.toContain("Bikash,Panda,Hari");
    expect(parsed.rawNotes).toBe("Hello World dddde\n# Section 1\nContent here");
  });

  it("handles plain notes without metadata headers", () => {
    const input = `# Simple Note

Just markdown content.
`;
    const parsed = mainHelpers.parseDocument(input, "C:/notes/plain.md");

    expect(parsed.header).toBe("");
    expect(parsed.rawNotes).toBe(input.trim());
  });
});
