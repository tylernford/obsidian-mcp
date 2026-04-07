import { vi } from "vitest";

// Stub — tests wire up return values via vi.mocked(prepareSimpleSearch).
// The real Obsidian prepareSimpleSearch returns a function that scores text.
export const prepareSimpleSearch =
  vi.fn<
    (
      query: string,
    ) =>
      | ((
          text: string,
        ) => { score: number; matches: [number, number][] } | null)
      | null
  >();

// Real implementation — just strips leading/trailing slashes and collapses repeats.
export function normalizePath(path: string): string {
  return path.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export class TFile {
  vault: unknown;
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number; size: number };

  constructor(path = "untitled.md") {
    this.path = path;
    this.name = path.split("/").pop() ?? path;
    this.extension = this.name.includes(".") ? this.name.split(".").pop()! : "";
    this.basename = this.name.replace(`.${this.extension}`, "");
    this.stat = { ctime: 0, mtime: 0, size: 0 };
  }
}
