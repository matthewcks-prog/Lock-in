export type ChromeManifest = {
  update_url?: string;
  version?: string;
};

export type ChromeRuntimeLike = {
  getManifest?: () => ChromeManifest;
  onSuspend?: { addListener: (listener: () => void) => void };
};

export type ChromeStorageSyncLike = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

export type ChromeLike = {
  runtime?: ChromeRuntimeLike;
  storage?: { sync?: ChromeStorageSyncLike };
};
