export type SearchMatchPart = [number, number];
export type SearchMatches = SearchMatchPart[];

export interface SearchResult {
  score: number;
  matches: SearchMatches;
}

export function prepareSimpleSearch(
  _query: string,
): (text: string) => SearchResult | null {
  return () => null;
}

export function normalizePath(path: string): string {
  // Strip leading/trailing slashes, collapse consecutive slashes
  return path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export class Plugin {
  app = {} as App;
  manifest = {} as PluginManifest;

  onload(): Promise<void> | void {}
  onunload(): void {}
  async loadData(): Promise<unknown> {
    return null;
  }
  async saveData(_data: unknown): Promise<void> {}
  addSettingTab(_settingTab: PluginSettingTab): void {}
}

export class Notice {
  constructor(_message: string | DocumentFragment, _timeout?: number) {}
}

export interface App {
  vault: Vault;
  workspace: Workspace;
  metadataCache: MetadataCache;
  fileManager: FileManager;
  commands: Commands;
  secretStorage: SecretStorage;
  plugins: Plugins;
}

export interface Plugins {
  getPlugin(id: string): unknown;
}

export class SecretStorage {
  private _secrets = new Map<string, string>();

  getSecret(id: string): string | null {
    return this._secrets.get(id) ?? null;
  }
  setSecret(id: string, secret: string): void {
    this._secrets.set(id, secret);
  }
  listSecrets(): string[] {
    return Array.from(this._secrets.keys());
  }
}

export interface Vault {
  getAbstractFileByPath(path: string): TAbstractFile | null;
  getRoot(): TFolder;
  read(file: TFile): Promise<string>;
  cachedRead(file: TFile): Promise<string>;
  getMarkdownFiles(): TFile[];
  create(path: string, content: string): Promise<TFile>;
  trash(file: TFile, useSystemTrash: boolean): Promise<void>;
}

export interface Workspace {
  getActiveFile(): TFile | null;
  openLinkText(
    linktext: string,
    sourcePath: string,
    newLeaf?: boolean,
  ): Promise<void>;
}

export interface CachedMetadata {
  frontmatter?: Record<string, unknown>;
  tags?: Array<{ tag: string; position: unknown }>;
}

export interface MetadataCache {
  getFileCache(file: TFile): CachedMetadata | null;
}

export interface Command {
  id: string;
  name: string;
}

export interface FileManager {
  trashFile(file: TAbstractFile): Promise<void>;
  processFrontMatter(
    file: TFile,
    fn: (frontmatter: Record<string, unknown>) => void,
  ): Promise<void>;
}

export interface Commands {
  commands: Record<string, Command>;
  executeCommandById(id: string): boolean;
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

export class TFile extends TAbstractFile {
  stat = { ctime: 0, mtime: 0, size: 0 };
  basename = "";
  extension = "md";
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return this.path === "" || this.path === "/";
  }
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = createObsidianEl("div");
  }

  display(): void {}
  hide(): void {}
}

/**
 * Creates an HTMLElement with Obsidian's augmented methods (createEl, empty).
 * Obsidian monkey-patches these onto HTMLElement.prototype at runtime.
 */
function createObsidianEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: { text?: string; cls?: string | string[]; attr?: Record<string, string> },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text) el.textContent = o.text;
  if (o?.cls) {
    const classes = Array.isArray(o.cls) ? o.cls : o.cls.split(" ");
    el.classList.add(...classes);
  }
  if (o?.attr) {
    for (const [k, v] of Object.entries(o.attr)) {
      el.setAttribute(k, v);
    }
  }

  // Obsidian augments HTMLElement.prototype with createEl/empty at runtime.
  // We attach them directly to each element in the mock.
  const record = el as unknown as Record<string, unknown>;

  record.createEl = (
    childTag: string,
    childOpts?: {
      text?: string;
      cls?: string | string[];
      attr?: Record<string, string>;
    },
  ) => {
    const child = createObsidianEl(
      childTag as keyof HTMLElementTagNameMap,
      childOpts,
    );
    el.appendChild(child);
    return child;
  };

  record.empty = () => {
    el.replaceChildren();
  };

  return el;
}

export class Setting {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.infoEl = document.createElement("div");
    this.nameEl = document.createElement("div");
    this.descEl = document.createElement("div");
    this.controlEl = document.createElement("div");
    this.infoEl.appendChild(this.nameEl);
    this.infoEl.appendChild(this.descEl);
    this.settingEl.appendChild(this.infoEl);
    this.settingEl.appendChild(this.controlEl);
    containerEl.appendChild(this.settingEl);
  }

  setName(name: string | DocumentFragment): this {
    if (typeof name === "string") this.nameEl.textContent = name;
    else this.nameEl.appendChild(name);
    return this;
  }
  setDesc(desc: string | DocumentFragment): this {
    if (typeof desc === "string") this.descEl.textContent = desc;
    else this.descEl.appendChild(desc);
    return this;
  }
  setClass(_cls: string): this {
    return this;
  }
  setHeading(): this {
    return this;
  }
  addText(cb: (component: TextComponent) => unknown): this {
    const tc = new TextComponent(this.controlEl);
    this.controlEl.appendChild(tc.inputEl);
    cb(tc);
    return this;
  }
  addButton(cb: (component: ButtonComponent) => unknown): this {
    const bc = new ButtonComponent(this.controlEl);
    this.controlEl.appendChild(bc.buttonEl);
    cb(bc);
    return this;
  }
}

export class TextComponent {
  inputEl: HTMLInputElement;

  constructor(containerEl: HTMLElement) {
    this.inputEl = containerEl.ownerDocument
      ? containerEl.ownerDocument.createElement("input")
      : document.createElement("input");
  }

  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }
  setPlaceholder(_placeholder: string): this {
    return this;
  }
  setDisabled(_disabled: boolean): this {
    return this;
  }
  onChange(_callback: (value: string) => unknown): this {
    return this;
  }
}

export class ButtonComponent {
  buttonEl: HTMLButtonElement;

  constructor(containerEl: HTMLElement) {
    this.buttonEl = containerEl.ownerDocument
      ? containerEl.ownerDocument.createElement("button")
      : document.createElement("button");
  }

  setButtonText(name: string): this {
    this.buttonEl.textContent = name;
    return this;
  }
  setCta(): this {
    return this;
  }
  setWarning(): this {
    return this;
  }
  setIcon(_icon: string): this {
    return this;
  }
  setDisabled(_disabled: boolean): this {
    return this;
  }
  onClick(callback: (evt: MouseEvent) => unknown): this {
    this._clickHandler = callback;
    return this;
  }
  _clickHandler?: (evt: MouseEvent) => unknown;
}

export class Modal {
  app: App;
  containerEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  shouldRestoreSelection = true;

  constructor(app: App) {
    this.app = app;
    this.containerEl = createObsidianEl("div");
    this.modalEl = createObsidianEl("div");
    this.titleEl = createObsidianEl("div");
    this.contentEl = createObsidianEl("div");
  }

  open(): void {}
  close(): void {}
  onOpen(): Promise<void> | void {}
  onClose(): void {}
  setTitle(_title: string): this {
    return this;
  }
  setContent(_content: string | DocumentFragment): this {
    return this;
  }
}
