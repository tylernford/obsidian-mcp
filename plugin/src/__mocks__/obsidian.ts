export class Plugin {
  app = {} as App;
  manifest = {} as PluginManifest;

  async onload(): Promise<void> {}
  onunload(): void {}
}

export class Notice {
  constructor(_message: string | DocumentFragment, _timeout?: number) {}
}

export interface App {
  vault: Vault;
}

export interface Vault {
  getAbstractFileByPath(path: string): TAbstractFile | null;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
}

export abstract class TAbstractFile {
  path = "";
  name = "";
}
