import {
  applyPatch,
  PatchFailed,
  ContentType,
  type PatchInstruction,
} from "markdown-patch";
import type { App, TFile } from "obsidian";

export interface UpdateParams {
  operation: "append" | "prepend" | "replace";
  targetType: "heading" | "block" | "frontmatter";
  target: string;
  content: string;
  createIfMissing?: boolean;
}

export function buildPatchInstruction(params: UpdateParams): PatchInstruction {
  const createTargetIfMissing = params.createIfMissing ?? false;

  if (params.targetType === "frontmatter") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(params.content) as unknown;
    } catch {
      parsed = params.content;
    }
    return {
      operation: params.operation,
      targetType: "frontmatter",
      target: params.target,
      contentType: ContentType.json,
      content: parsed,
      createTargetIfMissing,
    } as PatchInstruction;
  }

  if (params.targetType === "heading") {
    return {
      operation: params.operation,
      targetType: "heading",
      target: params.target.split("::"),
      contentType: ContentType.text,
      content: params.content,
      trimTargetWhitespace: false,
      applyIfContentPreexists: false,
      createTargetIfMissing,
    } as PatchInstruction;
  }

  return {
    operation: params.operation,
    targetType: "block",
    target: params.target,
    contentType: ContentType.text,
    content: params.content,
    trimTargetWhitespace: false,
    applyIfContentPreexists: false,
    createTargetIfMissing,
  } as PatchInstruction;
}

export async function applyUpdate(
  app: App,
  file: TFile,
  params: UpdateParams,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: true }> {
  const instruction = buildPatchInstruction(params);

  try {
    await app.vault.process(file, (data) => applyPatch(data, instruction));
  } catch (e) {
    if (e instanceof PatchFailed) {
      return {
        content: [{ type: "text" as const, text: `Patch failed: ${e.reason}` }],
        isError: true,
      };
    }
    throw e;
  }

  return {
    content: [{ type: "text" as const, text: `Updated ${file.path}` }],
  };
}
