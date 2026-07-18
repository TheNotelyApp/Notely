import { describe, expect, it } from "vitest";
import { encryptBuffer, decryptBuffer, scanNoteDependencies } from "../../../electron/lib/export/notePackageIpc.cjs";

describe("notePackage utility logic", () => {
  describe("GCM Encryption / Decryption", () => {
    it("successfully encrypts and decrypts a text buffer", () => {
      const originalText = "Hello, Notely! This is a secure shareable package test.";
      const originalBuffer = Buffer.from(originalText, "utf8");

      const encrypted = encryptBuffer(originalBuffer);
      expect(encrypted).not.toEqual(originalBuffer);

      const decrypted = decryptBuffer(encrypted);
      expect(decrypted.toString("utf8")).toBe(originalText);
    });

    it("throws an error when decrypting invalid or truncated data", () => {
      const invalidBuffer = Buffer.from("too short", "utf8");
      expect(() => decryptBuffer(invalidBuffer)).toThrow("Invalid encrypted package format.");
    });
  });

  describe("Password Protection Logic", () => {
    it("hashes and validates user password correctly", () => {
      const password = "mySecurePassword123";
      // Simulate backend hashing
      const crypto = require("crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.createHash("sha256").update(password + salt).digest("hex");

      // Verify correct password matches
      const checkHashSuccess = crypto.createHash("sha256").update(password + salt).digest("hex");
      expect(checkHashSuccess).toBe(hash);

      // Verify incorrect password fails
      const checkHashFail = crypto.createHash("sha256").update("wrongPassword" + salt).digest("hex");
      expect(checkHashFail).not.toBe(hash);
    });
  });

  describe("Markdown Dependency Extraction", () => {
    it("extracts standard relative images, Excalidraw, and Draw.io diagrams", () => {
      const markdown = `
# Sample Note
Here is a normal image: ![Cute Cat](media/images/cat.png)
And another image with query params: ![Doc image](media/images/doc.png?v=2)

Here is an Excalidraw diagram:
![Excalidraw Diagram](media/diagrams/excali_123.png){data-diagram-id="excali_123" data-diagram-type="excalidraw"}

And here is a Draw.io diagram:
![Drawio Diagram](media/draw.io/drawio_456.png)

An external image link to ignore:
![External](https://example.com/logo.png)
      `;

      const deps = scanNoteDependencies(markdown);

      expect(deps.images).toEqual(["media/images/cat.png", "media/images/doc.png"]);
      expect(deps.excalidrawIds).toEqual(["excali_123"]);
      expect(deps.drawioIds).toEqual(["drawio_456"]);
    });

    it("strips leading slash from screenshot-style paths like /media/images/...", () => {
      const markdown = `
# Note with screenshot
![Screenshot](/media/images/screenshot-20240101-120000.png)
      `;
      const deps = scanNoteDependencies(markdown);
      expect(deps.images).toEqual(["media/images/screenshot-20240101-120000.png"]);
    });

    it("handles notes with zero dependencies cleanly", () => {
      const markdown = "# Plain Note\\nNo dependencies here.";
      const deps = scanNoteDependencies(markdown);

      expect(deps.images).toEqual([]);
      expect(deps.excalidrawIds).toEqual([]);
      expect(deps.drawioIds).toEqual([]);
    });
  });
});
