(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createExtensionFetcherFactory({ networkUtils, transcriptProviders }) {
    const fetchWithCredentials = networkUtils?.fetchWithCredentials;
    const fetchHtmlWithRedirectInfo = networkUtils?.fetchHtmlWithRedirectInfo;
    const extractPanoptoInfoFromHtml = transcriptProviders?.extractPanoptoInfoFromHtml;

    class ExtensionFetcher {
      async fetchWithCredentials(url) {
        return fetchWithCredentials(url);
      }

      async fetchJson(url) {
        const text = await this.fetchWithCredentials(url);
        return JSON.parse(text);
      }

      async fetchHtmlWithRedirectInfo(url) {
        return fetchHtmlWithRedirectInfo(url);
      }

      extractPanoptoInfoFromHtml(html, baseUrl) {
        if (typeof extractPanoptoInfoFromHtml !== 'function') {
          return null;
        }
        return extractPanoptoInfoFromHtml(html, baseUrl);
      }
    }

    return () => new ExtensionFetcher();
  }

  transcripts.extensionFetcher = {
    createExtensionFetcherFactory,
  };
})();
