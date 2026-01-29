import { beforeEach, describe, expect, it } from 'vitest';
import { getProviderForUrl, getProviderRegistry, registerProvider } from '../providerRegistry';
import { Echo360Provider } from '../providers/echo360Provider';
import { PanoptoProvider } from '../providers/panoptoProvider';

describe('provider registry', () => {
  beforeEach(() => {
    getProviderRegistry().clear();
  });

  it('selects providers based on URL', () => {
    registerProvider(new PanoptoProvider());
    registerProvider(new Echo360Provider());

    const panoptoProvider = getProviderForUrl(
      'https://monash.au.panopto.com/Panopto/Pages/Embed.aspx?id=abc12345-1234-5678-9abc-def012345678',
    );
    expect(panoptoProvider?.provider).toBe('panopto');

    const echoProvider = getProviderForUrl(
      'https://echo360.net.au/lesson/11111111-2222-3333-4444-555555555555/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(echoProvider?.provider).toBe('echo360');

    expect(getProviderForUrl('https://example.com')).toBeNull();
  });
});
