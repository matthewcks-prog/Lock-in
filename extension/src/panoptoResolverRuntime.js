(() => {
  function panoptoRuntimeProbe() {
    const candidates = [];
    const seen = new Set();
    let podcastDisabled = false;
    let downloadEnabled = false;
    let disabledReason = null;

    const decodeEscaped = (value) =>
      value
        .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\\//g, '/')
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"')
        .trim();

    const normalizeUrl = (rawUrl) => {
      if (!rawUrl) return null;
      const decoded = decodeEscaped(rawUrl);
      if (!decoded || decoded.startsWith('javascript:')) return null;
      try {
        return new URL(decoded, window.location.href).toString();
      } catch {
        return decoded;
      }
    };

    const looksLikeMediaUrl = (url) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      if (lower.startsWith('blob:') || lower.startsWith('data:')) return false;
      if (lower.includes('.m3u8')) return false;
      if (['.mp4', '.m4a', '.mp3'].some((ext) => lower.includes(ext))) {
        return true;
      }
      return ['/podcast/', 'podcast', 'download'].some((hint) => lower.includes(hint));
    };

    const addCandidate = (rawUrl, source) => {
      const normalized = normalizeUrl(rawUrl);
      if (!normalized || !looksLikeMediaUrl(normalized)) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push({ url: normalized, source });
    };

    const metaTags = document.querySelectorAll(
      'meta[property="og:video"], meta[property="og:video:secure_url"], meta[name="og:video"], meta[name="og:video:secure_url"]',
    );
    metaTags.forEach((meta) => {
      const content = meta.getAttribute('content');
      if (content) {
        addCandidate(content, 'runtime:og:video');
      }
    });

    const dataUrlNodes = document.querySelectorAll(
      '[data-podcast-url], [data-download-url], [data-stream-url], [data-video-url]',
    );
    dataUrlNodes.forEach((node) => {
      const attrs = ['data-podcast-url', 'data-download-url', 'data-stream-url', 'data-video-url'];
      attrs.forEach((attr) => {
        const value = node.getAttribute(attr);
        if (value) {
          addCandidate(value, 'runtime:data-url');
        }
      });
    });

    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && /podcast|download/i.test(href)) {
        addCandidate(href, 'runtime:link');
      }
    });

    const downloadControls = document.querySelectorAll(
      '[aria-label*="Download" i], [title*="Download" i], [data-tooltip*="Download" i]',
    );
    downloadControls.forEach((control) => {
      const ariaDisabled = control.getAttribute('aria-disabled');
      const isDisabled = control.hasAttribute('disabled') || ariaDisabled === 'true';
      if (isDisabled && !podcastDisabled) {
        podcastDisabled = true;
        disabledReason = 'download-control-disabled';
      }
    });

    const rootObjects = [
      { name: 'Panopto', value: window.Panopto },
      { name: 'panopto', value: window.panopto },
      { name: 'PanoptoViewer', value: window.PanoptoViewer },
      { name: '__PANOPTO_STATE__', value: window.__PANOPTO_STATE__ },
      { name: '__INITIAL_STATE__', value: window.__INITIAL_STATE__ },
    ];

    const visited = new WeakSet();
    const maxDepth = 4;
    let inspected = 0;
    const maxNodes = 1500;

    const scan = (value, path, depth) => {
      if (!value || typeof value !== 'object') return;
      if (visited.has(value)) return;
      if (inspected > maxNodes) return;
      visited.add(value);
      inspected += 1;
      if (depth > maxDepth) return;

      Object.keys(value).forEach((key) => {
        try {
          const next = value[key];
          const nextPath = `${path}.${key}`;
          if (typeof next === 'string') {
            if (looksLikeMediaUrl(next)) {
              addCandidate(next, `runtime:${nextPath}`);
            }
          } else if (typeof next === 'boolean') {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('download') || lowerKey.includes('podcast')) {
              if (next === false && !podcastDisabled) {
                podcastDisabled = true;
                disabledReason = `state:${nextPath}`;
              }
              if (next === true) {
                downloadEnabled = true;
              }
            }
          } else if (typeof next === 'object' && next) {
            scan(next, nextPath, depth + 1);
          }
        } catch {
          // Ignore access errors
        }
      });
    };

    rootObjects.forEach((root) => {
      if (root.value && typeof root.value === 'object') {
        scan(root.value, root.name, 0);
      }
    });

    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const entries = performance.getEntriesByType('resource');
      for (let i = 0; i < entries.length && candidates.length < 20; i += 1) {
        const entry = entries[i];
        if (entry && typeof entry.name === 'string' && looksLikeMediaUrl(entry.name)) {
          addCandidate(entry.name, 'runtime:perf');
        }
      }
    }

    return {
      pageUrl: window.location.href,
      candidates,
      podcastDisabled,
      downloadEnabled,
      disabledReason,
    };
  }

  function executeScriptInTab(tabId, func) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === 'undefined' ||
        !chrome.scripting ||
        typeof chrome.scripting.executeScript !== 'function'
      ) {
        reject(new Error('chrome.scripting.executeScript unavailable'));
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          world: 'MAIN',
          func,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(results || []);
        },
      );
    });
  }

  async function runPanoptoRuntimeProbe(tabId, logger) {
    if (!tabId) {
      logger.debug('runtime-probe', {
        status: 'skipped',
        meta: { reason: 'no-tab-id' },
      });
      return { candidates: [], podcastDisabled: false, downloadEnabled: false };
    }

    const started = Date.now();
    try {
      const results = await executeScriptInTab(tabId, panoptoRuntimeProbe);
      const candidates = [];
      let podcastDisabled = false;
      let downloadEnabled = false;
      let disabledReason = null;
      let frameCount = 0;

      results.forEach((entry) => {
        const data = entry && entry.result ? entry.result : null;
        if (!data || !data.candidates) return;
        const pageUrl = typeof data.pageUrl === 'string' ? data.pageUrl : '';
        if (pageUrl && !pageUrl.includes('panopto')) return;
        frameCount += 1;
        data.candidates.forEach((candidate) => {
          if (!candidate || !candidate.url) return;
          candidates.push({
            url: candidate.url,
            source: candidate.source || 'runtime',
            frameUrl: pageUrl,
          });
        });
        if (data.podcastDisabled) {
          podcastDisabled = true;
          disabledReason = data.disabledReason || disabledReason;
        }
        if (data.downloadEnabled) {
          downloadEnabled = true;
        }
      });

      logger.debug('runtime-probe', {
        status: 'ok',
        elapsedMs: Date.now() - started,
        meta: {
          frameCount,
          candidateCount: candidates.length,
          podcastDisabled,
          downloadEnabled,
        },
      });

      return { candidates, podcastDisabled, downloadEnabled, disabledReason };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('runtime-probe', {
        status: 'error',
        elapsedMs: Date.now() - started,
        meta: { error: message },
      });
      return {
        candidates: [],
        podcastDisabled: false,
        downloadEnabled: false,
        error: message,
      };
    }
  }

  if (typeof self !== 'undefined') {
    self.LockInPanoptoResolverRuntime = {
      runPanoptoRuntimeProbe,
    };
  }
})();
