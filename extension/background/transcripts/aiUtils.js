(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  const TRACKING_QUERY_KEYS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'utm_name',
    'gclid',
    'dclid',
    'fbclid',
    'msclkid',
    'yclid',
    'igshid',
    '_ga',
    '_gid',
    '_gac',
    '_gl',
    'mc_cid',
    'mc_eid',
    'hsa_acc',
    'hsa_cam',
    'hsa_grp',
    'hsa_ad',
    'hsa_src',
    'hsa_tgt',
    'hsa_kw',
    'hsa_mt',
    'hsa_net',
    'hsa_ver',
  ]);

  function normalizeMediaUrl(mediaUrl) {
    if (!mediaUrl) return '';
    try {
      const url = new URL(mediaUrl);
      url.hash = '';
      const params = url.searchParams;
      for (const key of Array.from(params.keys())) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('utm_') || TRACKING_QUERY_KEYS.has(lowerKey)) {
          params.delete(key);
        }
      }
      const nextSearch = params.toString();
      url.search = nextSearch ? `?${nextSearch}` : '';
      return url.toString();
    } catch {
      return mediaUrl;
    }
  }

  function isAuthStatus(status) {
    return status === 401 || status === 403;
  }

  function isBlobUrl(mediaUrl) {
    return typeof mediaUrl === 'string' && mediaUrl.startsWith('blob:');
  }

  function fallbackHash(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  async function hashStringSha256(value) {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return fallbackHash(value);
    }
    const encoded = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  transcripts.aiUtils = {
    TRACKING_QUERY_KEYS,
    normalizeMediaUrl,
    isAuthStatus,
    isBlobUrl,
    fallbackHash,
    hashStringSha256,
  };
})();
