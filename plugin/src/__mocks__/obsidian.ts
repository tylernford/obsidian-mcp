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
  secretStorage: SecretStorage;
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

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;

  constructor(_containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.infoEl = document.createElement("div");
    this.nameEl = document.createElement("div");
    this.descEl = document.createElement("div");
    this.controlEl = document.createElement("div");
  }

  setName(_name: string | DocumentFragment): this {
    return this;
  }
  setDesc(_desc: string | DocumentFragment): this {
    return this;
  }
  setClass(_cls: string): this {
    return this;
  }
  setHeading(): this {
    return this;
  }
  addText(cb: (component: TextComponent) => unknown): this {
    cb(new TextComponent(document.createElement("div")));
    return this;
  }
  addButton(cb: (component: ButtonComponent) => unknown): this {
    cb(new ButtonComponent(document.createElement("div")));
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

  setValue(_value: string): this {
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

  setButtonText(_name: string): this {
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
    this.containerEl = document.createElement("div");
    this.modalEl = document.createElement("div");
    this.titleEl = document.createElement("div");
    this.contentEl = document.createElement("div");
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
