import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { registerCodeExecutorIpcHandlers } = require("../electron/lib/ipc/codeExecutorIpc.cjs");

describe("codeExecutorIpc", () => {
  it("exports registerCodeExecutorIpcHandlers function", () => {
    expect(typeof registerCodeExecutorIpcHandlers).toBe("function");
  });
});
