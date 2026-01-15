export interface StorageAdapter {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  getLocal?: (key: string) => Promise<unknown>;
  setLocal?: (key: string, value: unknown) => Promise<void>;
}

export type SidebarTabId = 'chat' | 'notes' | 'tool';
