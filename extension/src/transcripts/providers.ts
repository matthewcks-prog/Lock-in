import type { DetectedVideo } from '@core/transcripts/types';
import {
  Echo360Provider,
  getProviderRegistry,
  Html5Provider,
  PanoptoProvider,
  registerProvider,
} from '@core/transcripts';

let providersRegistered = false;

export function ensureProvidersRegistered(): void {
  if (providersRegistered) return;
  registerProvider(new PanoptoProvider());
  registerProvider(new Echo360Provider());
  registerProvider(new Html5Provider());
  providersRegistered = true;
}

export function getProviderForVideo(video: DetectedVideo) {
  const registry = getProviderRegistry();
  const providers = registry.getAll();
  return providers.find((provider) => provider.provider === video.provider) || null;
}
