import { describe, it, expect } from "vitest";
import { generateApiKey } from "./crypto";

describe("generateApiKey", () => {
  it("returns a 64-character hex string", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique values on successive calls", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});
