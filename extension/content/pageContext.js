/**
 * Page context + adapter resolution for the content script.
 * Keeps site detection isolated from the orchestrator.
 */
(function () {
  function buildFallbackAdapter() {
    return {
      getPageContext(dom, url) {
        const heading = dom.querySelector("h1, h2")?.textContent?.trim() || dom.title;
        let courseCode = null;

        const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
        if (urlMatch) {
          courseCode = urlMatch[1].toUpperCase();
        } else {
          const bodyText = dom.body?.innerText || "";
          const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
          if (codeMatch) {
            courseCode = codeMatch[1].toUpperCase();
          }
        }

        return {
          url,
          title: dom.title,
          heading,
          courseContext: {
            courseCode,
            sourceUrl: url,
          },
        };
      },
    };
  }

  function resolveAdapterContext(logger) {
    const log = logger || { error: console.error, warn: console.warn, debug: () => {} };
    let adapter = null;
    let pageContext = null;

    try {
      if (typeof window.getCurrentAdapter === "function") {
        adapter = window.getCurrentAdapter();
      }

      if (!adapter) {
        adapter = buildFallbackAdapter();
      }

      pageContext = adapter.getPageContext(document, window.location.href);
    } catch (error) {
      log.error("Failed to get page context:", error);
      adapter = adapter || buildFallbackAdapter();
      pageContext = {
        url: window.location.href,
        title: document.title,
        courseContext: { courseCode: null, sourceUrl: window.location.href },
      };
    }

    return { adapter, pageContext };
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.resolveAdapterContext = resolveAdapterContext;
})();
