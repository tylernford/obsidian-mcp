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
