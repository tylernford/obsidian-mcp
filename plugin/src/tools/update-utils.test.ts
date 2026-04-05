import { describe, it, expect, vi } from "vitest";
import {
  applyPatch,
  ContentType,
  PatchFailed,
  PatchFailureReason,
} from "markdown-patch";
import { TFile } from "obsidian";
import {
  buildPatchInstruction,
  applyUpdate,
  type UpdateParams,
} from "./update-utils";

// Mock only applyPatch — returns a fixed string so we can verify it flows
// through vault.process without testing markdown-patch internals.
vi.mock("markdown-patch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("markdown-patch")>();
  return {
    ...actual,
    applyPatch: vi.fn((_doc: string, _instr: unknown) => "patched"),
  };
});

const applyPatchMock = vi.mocked(applyPatch);

// ---------------------------------------------------------------------------
// buildPatchInstruction
// ---------------------------------------------------------------------------

describe("buildPatchInstruction", () => {
  // --- frontmatter target type ---

  it("parses JSON content for frontmatter target", () => {
    const result = buildPatchInstruction({
      operation: "replace",
      targetType: "frontmatter",
      target: "tags",
      content: '["a","b"]',
    });

    expect(result).toMatchObject({
      operation: "replace",
      targetType: "frontmatter",
      target: "tags",
      contentType: ContentType.json,
      content: ["a", "b"],
      createTargetIfMissing: false,
    });
  });

  it("falls back to raw string when JSON parse fails", () => {
    const result = buildPatchInstruction({
      operation: "append",
      targetType: "frontmatter",
      target: "note",
      content: "not json {",
    });

    expect(result.content).toBe("not json {");
    expect(result.contentType).toBe(ContentType.json);
  });

  // --- createIfMissing ---

  it("defaults createTargetIfMissing to false", () => {
    const result = buildPatchInstruction({
      operation: "replace",
      targetType: "block",
      target: "abc",
      content: "text",
    });

    expect(result.createTargetIfMissing).toBe(false);
  });

  it("passes through createIfMissing when provided", () => {
    const result = buildPatchInstruction({
      operation: "replace",
      targetType: "block",
      target: "abc",
      content: "text",
      createIfMissing: true,
    });

    expect(result.createTargetIfMissing).toBe(true);
  });

  // --- heading target type ---

  it("splits heading target on ::", () => {
    const result = buildPatchInstruction({
      operation: "append",
      targetType: "heading",
      target: "Section::Subsection",
      content: "body",
    });

    expect(result.target).toEqual(["Section", "Subsection"]);
    expect(result.contentType).toBe(ContentType.text);
  });

  it("produces single-element array for heading without ::", () => {
    const result = buildPatchInstruction({
      operation: "replace",
      targetType: "heading",
      target: "TopLevel",
      content: "body",
    });

    expect(result.target).toEqual(["TopLevel"]);
  });

  // Cast through Record because these properties are set by our code but
  // aren't exposed on every variant of the PatchInstruction union type.
  it("sets trimTargetWhitespace and applyIfContentPreexists to false for headings", () => {
    const result = buildPatchInstruction({
      operation: "append",
      targetType: "heading",
      target: "H",
      content: "body",
    });

    expect(
      (result as unknown as Record<string, unknown>).trimTargetWhitespace,
    ).toBe(false);
    expect(
      (result as unknown as Record<string, unknown>).applyIfContentPreexists,
    ).toBe(false);
  });

  // --- block target type ---

  it("passes block target through as-is", () => {
    const result = buildPatchInstruction({
      operation: "prepend",
      targetType: "block",
      target: "my-block",
      content: "content",
    });

    expect(result).toMatchObject({
      operation: "prepend",
      targetType: "block",
      target: "my-block",
      contentType: ContentType.text,
    });
  });

  it("sets trimTargetWhitespace and applyIfContentPreexists to false for blocks", () => {
    const result = buildPatchInstruction({
      operation: "replace",
      targetType: "block",
      target: "blk",
      content: "c",
    });

    expect(
      (result as unknown as Record<string, unknown>).trimTargetWhitespace,
    ).toBe(false);
    expect(
      (result as unknown as Record<string, unknown>).applyIfContentPreexists,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyUpdate
// ---------------------------------------------------------------------------

describe("applyUpdate", () => {
  const file = Object.assign(new TFile(), { path: "notes/test.md" });

  // Simulates vault.process: reads file content ("original") and passes it
  // to the callback, whose return value becomes the new file content.
  function makeApp() {
    return {
      vault: {
        process: vi.fn(async (_file: TFile, fn: (data: string) => string) => {
          return fn("original");
        }),
      },
    } as unknown as import("obsidian").App;
  }

  const baseParams: UpdateParams = {
    operation: "replace",
    targetType: "block",
    target: "blk",
    content: "new content",
  };

  it("returns patched content to vault.process", async () => {
    const app = makeApp();
    await applyUpdate(app, file, baseParams);

    await expect(
      vi.mocked(app.vault.process).mock.results[0]!.value,
    ).resolves.toBe("patched");
  });

  it("catches PatchFailed and returns isError", async () => {
    applyPatchMock.mockImplementationOnce(() => {
      throw new PatchFailed(
        PatchFailureReason.InvalidTarget,
        {} as never,
        null,
      );
    });

    const app = makeApp();
    const result = await applyUpdate(app, file, baseParams);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Patch failed");
    expect(result.content[0]!.text).toContain(PatchFailureReason.InvalidTarget);
  });

  it("re-throws non-PatchFailed errors", async () => {
    applyPatchMock.mockImplementationOnce(() => {
      throw new Error("unexpected");
    });

    const app = makeApp();

    await expect(applyUpdate(app, file, baseParams)).rejects.toThrow(
      "unexpected",
    );
  });
});
