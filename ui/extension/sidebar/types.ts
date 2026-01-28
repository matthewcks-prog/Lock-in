export interface StorageAdapter {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<void>;
  getLocal?: <T = unknown>(key: string) => Promise<T | null>;
  setLocal?: (key: string, value: unknown) => Promise<void>;
}

export type SidebarTabId = 'chat' | 'notes' | 'tool';
