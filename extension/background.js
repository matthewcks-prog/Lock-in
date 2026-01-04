/**
 * Lock-in Background Service Worker
 *
 * Handles context menu integration, per-tab session management, and extension-level coordination.
 * Uses the messaging system for typed communication.
 */

// Import shared libraries
try {
  importScripts("dist/libs/webvttParser.js");
} catch (e) {
  console.warn("Lock-in: Failed to import webvttParser.js:", e);
}
try {
  importScripts("config.js");
} catch (e) {
  console.warn("Lock-in: Failed to import config.js:", e);
}

// Import messaging system (available via global in service worker)
const Messaging =
  typeof self !== "undefined" && self.LockInMessaging
    ? self.LockInMessaging
    : null;

// Get shared VTT parser
const WebVtt =
  typeof self !== "undefined" && self.LockInWebVtt ? self.LockInWebVtt : null;

// ─────────────────────────────────────────────────────────────────────────────
// Transcript Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse WebVTT content into structured segments
 * Uses shared parser from dist/libs/webvttParser.js if available, otherwise fallback
 */
function parseWebVtt(vttContent) {
  if (WebVtt && typeof WebVtt.parseWebVtt === "function") {
    return WebVtt.parseWebVtt(vttContent);
  }
  // Fallback: minimal parser in case shared lib not loaded
  console.warn("Lock-in: Using fallback VTT parser");
  const lines = vttContent.split(/\r?\n/);
  const segments = [];
  const textParts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("WEBVTT") && !trimmed.includes("-->")) {
      textParts.push(trimmed);
    }
  }
  return {
    plainText: textParts.join(" "),
    segments,
    durationMs: 0,
  };
}

/**
 * Extract CaptionUrl from Panopto embed HTML
 */
function extractCaptionVttUrl(html) {
  // Pattern 1: "CaptionUrl":["..."]
  const captionUrlMatch = html.match(/"CaptionUrl"\s*:\s*\[\s*"([^"]+)"/);
  if (captionUrlMatch) return captionUrlMatch[1].replace(/\\/g, "");

  // Pattern 2: "Captions":[{"Url":"..."}]
  const captionsMatch = html.match(
    /"Captions"\s*:\s*\[\s*\{\s*"Url"\s*:\s*"([^"]+)"/
  );
  if (captionsMatch) return captionsMatch[1].replace(/\\/g, "");

  // Pattern 3: Direct GetCaptionVTT.ashx URL
  const directVttMatch = html.match(
    /https?:\/\/[^"]+GetCaptionVTT\.ashx\?[^"]+/
  );
  if (directVttMatch) return directVttMatch[0].replace(/\\/g, "");

  // Pattern 4: TranscriptUrl
  const transcriptMatch = html.match(/"TranscriptUrl"\s*:\s*"([^"]+)"/);
  if (transcriptMatch) return transcriptMatch[1].replace(/\\/g, "");

  return null;
}

/**
 * Helper to decode escaped URLs from Panopto JSON
 */
function decodeEscapedUrl(url) {
  return url
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x3D;/gi, "=")
    .replace(/&#39;/g, "'")
    .trim();
}

// Panopto Media Resolver (V2)
const PANOPTO_RESOLVER_TIMEOUT_MS = 15000;
const PANOPTO_RESOLVER_RANGE_HEADER = "bytes=0-0";
const PANOPTO_MEDIA_EXTENSIONS = [".mp4", ".m4a", ".mp3"];
const PANOPTO_MEDIA_HINTS = ["/podcast/", "podcast", "download"];

function parseBooleanConfig(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on", "debug", "trace"].includes(normalized);
  }
  return false;
}

function isPanoptoResolverDebugEnabled() {
  const direct = getConfigValue("DEBUG_PANOPTO_RESOLVER", null);
  if (direct !== null) return parseBooleanConfig(direct);
  const legacy = getConfigValue("DEBUG_PANOPTO", null);
  if (legacy !== null) return parseBooleanConfig(legacy);
  const debug = getConfigValue("DEBUG", null);
  if (debug !== null) return parseBooleanConfig(debug);
  const level = getConfigValue("LOG_LEVEL", "");
  return typeof level === "string" && ["debug", "trace"].includes(level.toLowerCase());
}

function truncateUrl(value) {
  if (!value || typeof value !== "string") return "";
  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

function createPanoptoResolverLogger(jobId, debugEnabled) {
  const prefix = "[Lock-in PanoptoResolver]";
  const startMs = Date.now();

  const log = (level, step, data, always) => {
    if (!always && !debugEnabled) return;
    const elapsedMs =
      data && typeof data.elapsedMs === "number"
        ? data.elapsedMs
        : Date.now() - startMs;
    const status = data?.status ? ` status=${data.status}` : "";
    const url = data?.url ? ` url=${truncateUrl(data.url)}` : "";
    const finalUrl = data?.finalUrl ? ` finalUrl=${truncateUrl(data.finalUrl)}` : "";
    const line = `${prefix} jobId=${jobId} step=${step}${status}${url}${finalUrl} ms=${elapsedMs}`;
    const meta = data?.meta;
    if (meta) {
      console[level](line, meta);
    } else {
      console[level](line);
    }
  };

  return {
    debug: (step, data) => log("debug", step, data, false),
    info: (step, data) => log("info", step, data, true),
    warn: (step, data) => log("warn", step, data, true),
    error: (step, data) => log("error", step, data, true),
    isDebugEnabled: () => debugEnabled,
  };
}

function extractPanoptoInfoFromUrl(url) {
  if (!url) return null;
  const match = url.match(
    /https?:\/\/([^/]+)\/Panopto\/Pages\/(?:Embed|Viewer)\.aspx\?[^#]*\bid=([a-f0-9-]+)/i
  );
  if (match) {
    return { tenant: match[1], deliveryId: match[2] };
  }

  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    if (!host.includes("panopto")) return null;
    const id = urlObj.searchParams.get("id");
    if (id) {
      return { tenant: host, deliveryId: id };
    }
  } catch {
    return null;
  }

  return null;
}

function buildPanoptoViewerUrl(tenant, deliveryId) {
  return `https://${tenant}/Panopto/Pages/Viewer.aspx?id=${encodeURIComponent(
    deliveryId
  )}`;
}

function buildPanoptoEmbedUrl(tenant, deliveryId) {
  return `https://${tenant}/Panopto/Pages/Embed.aspx?id=${encodeURIComponent(
    deliveryId
  )}`;
}

function buildPanoptoPodcastDownloadUrl(tenant, deliveryId) {
  if (!tenant || !deliveryId) return null;
  const url = new URL(
    `https://${tenant}/Panopto/Podcast/Download/${encodeURIComponent(deliveryId)}.mp4`
  );
  url.searchParams.set("mediaTargetType", "videoPodcast");
  return url.toString();
}

function looksLikePanoptoMediaUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("blob:") || lower.startsWith("data:")) {
    return false;
  }
  if (lower.includes(".m3u8")) {
    return false;
  }
  if (PANOPTO_MEDIA_EXTENSIONS.some((ext) => lower.includes(ext))) {
    return true;
  }
  return PANOPTO_MEDIA_HINTS.some((hint) => lower.includes(hint));
}

function normalizePanoptoCandidateUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  const decoded = decodeEscapedUrl(rawUrl);
  if (!decoded || decoded.startsWith("javascript:")) return null;
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}

function extractPanoptoMediaCandidatesFromHtml(html, baseUrl) {
  const candidates = [];
  const seen = new Set();
  let podcastDisabled = false;
  let downloadEnabled = false;
  let disabledReason = null;

  const addCandidate = (rawUrl, source) => {
    const normalized = normalizePanoptoCandidateUrl(rawUrl, baseUrl);
    if (!normalized || !looksLikePanoptoMediaUrl(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ url: normalized, source });
  };

  const urlPatterns = [
    { regex: /"PodcastUrl"\s*:\s*"([^"]+)"/gi, source: "html:PodcastUrl" },
    { regex: /"PodcastDownloadUrl"\s*:\s*"([^"]+)"/gi, source: "html:PodcastDownloadUrl" },
    { regex: /"DownloadUrl"\s*:\s*"([^"]+)"/gi, source: "html:DownloadUrl" },
    { regex: /"StreamUrl"\s*:\s*"([^"]+)"/gi, source: "html:StreamUrl" },
    { regex: /"IosStreamUrl"\s*:\s*"([^"]+)"/gi, source: "html:IosStreamUrl" },
    { regex: /"Mp4Url"\s*:\s*"([^"]+)"/gi, source: "html:Mp4Url" },
    { regex: /"VideoUrl"\s*:\s*"([^"]+)"/gi, source: "html:VideoUrl" },
  ];

  for (const pattern of urlPatterns) {
    for (const match of html.matchAll(pattern.regex)) {
      if (match?.[1]) {
        addCandidate(match[1], pattern.source);
      }
    }
  }

  for (const match of html.matchAll(
    /<meta[^>]+(?:property|name)=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi
  )) {
    if (match?.[1]) {
      addCandidate(match[1], "html:og:video");
    }
  }

  for (const match of html.matchAll(
    /data-(?:podcast|download|stream|video)-url=["']([^"']+)["']/gi
  )) {
    if (match?.[1]) {
      addCandidate(match[1], "html:data-url");
    }
  }

  for (const match of html.matchAll(
    /href=["']([^"']*\/Podcast\/[^"']+)["']/gi
  )) {
    if (match?.[1]) {
      addCandidate(match[1], "html:podcast-link");
    }
  }

  const disabledPatterns = [
    { regex: /"PodcastDownloadEnabled"\s*:\s*false/i, reason: "podcast-download-disabled" },
    { regex: /"DownloadEnabled"\s*:\s*false/i, reason: "download-disabled" },
    { regex: /"DownloadsEnabled"\s*:\s*false/i, reason: "downloads-disabled" },
    { regex: /"AllowDownload"\s*:\s*false/i, reason: "allow-download-false" },
    { regex: /data-download-enabled=["']false["']/i, reason: "data-download-enabled-false" },
  ];
  const enabledPatterns = [
    /"PodcastDownloadEnabled"\s*:\s*true/i,
    /"DownloadEnabled"\s*:\s*true/i,
    /"DownloadsEnabled"\s*:\s*true/i,
    /"AllowDownload"\s*:\s*true/i,
    /data-download-enabled=["']true["']/i,
  ];

  for (const entry of disabledPatterns) {
    if (entry.regex.test(html)) {
      podcastDisabled = true;
      disabledReason = entry.reason;
      break;
    }
  }

  if (enabledPatterns.some((pattern) => pattern.test(html))) {
    downloadEnabled = true;
  }

  return { candidates, podcastDisabled, disabledReason, downloadEnabled };
}

function panoptoRuntimeProbe() {
  const candidates = [];
  const seen = new Set();
  let podcastDisabled = false;
  let downloadEnabled = false;
  let disabledReason = null;

  const decodeEscaped = (value) =>
    value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\")
      .replace(/\\"/g, '"')
      .trim();

  const normalizeUrl = (rawUrl) => {
    if (!rawUrl) return null;
    const decoded = decodeEscaped(rawUrl);
    if (!decoded || decoded.startsWith("javascript:")) return null;
    try {
      return new URL(decoded, window.location.href).toString();
    } catch {
      return decoded;
    }
  };

  const looksLikeMediaUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.startsWith("blob:") || lower.startsWith("data:")) return false;
    if (lower.includes(".m3u8")) return false;
    if ([".mp4", ".m4a", ".mp3"].some((ext) => lower.includes(ext))) {
      return true;
    }
    return ["/podcast/", "podcast", "download"].some((hint) =>
      lower.includes(hint)
    );
  };

  const addCandidate = (rawUrl, source) => {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized || !looksLikeMediaUrl(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ url: normalized, source });
  };

  const metaTags = document.querySelectorAll(
    'meta[property="og:video"], meta[property="og:video:secure_url"], meta[name="og:video"], meta[name="og:video:secure_url"]'
  );
  metaTags.forEach((meta) => {
    const content = meta.getAttribute("content");
    if (content) {
      addCandidate(content, "runtime:og:video");
    }
  });

  const dataUrlNodes = document.querySelectorAll(
    "[data-podcast-url], [data-download-url], [data-stream-url], [data-video-url]"
  );
  dataUrlNodes.forEach((node) => {
    const attrs = ["data-podcast-url", "data-download-url", "data-stream-url", "data-video-url"];
    attrs.forEach((attr) => {
      const value = node.getAttribute(attr);
      if (value) {
        addCandidate(value, "runtime:data-url");
      }
    });
  });

  const anchors = document.querySelectorAll("a[href]");
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (href && /podcast|download/i.test(href)) {
      addCandidate(href, "runtime:link");
    }
  });

  const downloadControls = document.querySelectorAll(
    '[aria-label*="Download" i], [title*="Download" i], [data-tooltip*="Download" i]'
  );
  downloadControls.forEach((control) => {
    const ariaDisabled = control.getAttribute("aria-disabled");
    const isDisabled =
      control.hasAttribute("disabled") || ariaDisabled === "true";
    if (isDisabled && !podcastDisabled) {
      podcastDisabled = true;
      disabledReason = "download-control-disabled";
    }
  });

  const rootObjects = [
    { name: "Panopto", value: window.Panopto },
    { name: "panopto", value: window.panopto },
    { name: "PanoptoViewer", value: window.PanoptoViewer },
    { name: "__PANOPTO_STATE__", value: window.__PANOPTO_STATE__ },
    { name: "__INITIAL_STATE__", value: window.__INITIAL_STATE__ },
  ];

  const visited = new WeakSet();
  const maxDepth = 4;
  let inspected = 0;
  const maxNodes = 1500;

  const scan = (value, path, depth) => {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;
    if (inspected > maxNodes) return;
    visited.add(value);
    inspected += 1;
    if (depth > maxDepth) return;

    Object.keys(value).forEach((key) => {
      try {
        const next = value[key];
        const nextPath = `${path}.${key}`;
        if (typeof next === "string") {
          if (looksLikeMediaUrl(next)) {
            addCandidate(next, `runtime:${nextPath}`);
          }
        } else if (typeof next === "boolean") {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("download") || lowerKey.includes("podcast")) {
            if (next === false && !podcastDisabled) {
              podcastDisabled = true;
              disabledReason = `state:${nextPath}`;
            }
            if (next === true) {
              downloadEnabled = true;
            }
          }
        } else if (typeof next === "object" && next) {
          scan(next, nextPath, depth + 1);
        }
      } catch {
        // Ignore access errors
      }
    });
  };

  rootObjects.forEach((root) => {
    if (root.value && typeof root.value === "object") {
      scan(root.value, root.name, 0);
    }
  });

  if (typeof performance !== "undefined" && performance.getEntriesByType) {
    const entries = performance.getEntriesByType("resource");
    for (let i = 0; i < entries.length && candidates.length < 20; i += 1) {
      const entry = entries[i];
      if (entry && typeof entry.name === "string" && looksLikeMediaUrl(entry.name)) {
        addCandidate(entry.name, "runtime:perf");
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
    if (!chrome?.scripting?.executeScript) {
      reject(new Error("chrome.scripting.executeScript unavailable"));
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        world: "MAIN",
        func,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(results || []);
      }
    );
  });
}

async function runPanoptoRuntimeProbe(tabId, logger) {
  if (!tabId) {
    logger.debug("runtime-probe", { status: "skipped", meta: { reason: "no-tab-id" } });
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
      const data = entry?.result;
      if (!data || !data.candidates) return;
      const pageUrl = typeof data.pageUrl === "string" ? data.pageUrl : "";
      if (!pageUrl.includes("panopto")) return;
      frameCount += 1;
      data.candidates.forEach((candidate) => {
        if (candidate?.url) {
          candidates.push({
            url: candidate.url,
            source: candidate.source || "runtime",
            frameUrl: pageUrl,
          });
        }
      });
      if (data.podcastDisabled) {
        podcastDisabled = true;
        disabledReason = data.disabledReason || disabledReason;
      }
      if (data.downloadEnabled) {
        downloadEnabled = true;
      }
    });

    logger.debug("runtime-probe", {
      status: "ok",
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
    logger.warn("runtime-probe", {
      status: "error",
      elapsedMs: Date.now() - started,
      meta: { error: message },
    });
    return { candidates: [], podcastDisabled: false, downloadEnabled: false, error: message };
  }
}

function scorePanoptoCandidate(candidate) {
  const url = candidate?.url || "";
  const source = candidate?.source || "";
  const lower = url.toLowerCase();
  let score = 0;
  if (lower.includes("/podcast/")) score += 5;
  if (lower.includes("podcast")) score += 3;
  if (lower.includes("download")) score += 2;
  if (lower.includes(".mp4")) score += 3;
  if (lower.includes(".m4a")) score += 2;
  if (lower.includes(".mp3")) score += 1;
  if (lower.includes(".m3u8")) score -= 10;
  if (source.includes("og:video")) score -= 1;
  return score;
}

function dedupeAndSortPanoptoCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    if (!candidate?.url) continue;
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    unique.push(candidate);
  }
  return unique.sort((a, b) => scorePanoptoCandidate(b) - scorePanoptoCandidate(a));
}

async function probePanoptoMediaUrl(url, logger) {
  const started = Date.now();
  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        credentials: "include",
        redirect: "follow",
        headers: {
          Range: PANOPTO_RESOLVER_RANGE_HEADER,
          Accept: "video/*,audio/*,*/*",
        },
      },
      1,
      PANOPTO_RESOLVER_TIMEOUT_MS
    );

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";
    const contentRange = response.headers.get("content-range") || "";
    const finalUrl = response.url || url;

    if (response.body && typeof response.body.cancel === "function") {
      try {
        response.body.cancel();
      } catch {
        // Ignore stream cancel errors
      }
    }

    logger.debug("range-probe", {
      status: response.ok ? "ok" : "error",
      url,
      finalUrl,
      elapsedMs: Date.now() - started,
      meta: {
        status,
        contentType,
        contentRange,
      },
    });

    if (isAuthStatus(status)) {
      return { ok: false, status, errorCode: "AUTH_REQUIRED", finalUrl, contentType };
    }

    if (!response.ok) {
      return { ok: false, status, finalUrl, contentType };
    }

    if (contentType.toLowerCase().includes("text/html")) {
      return { ok: false, status, errorCode: "AUTH_REQUIRED", finalUrl, contentType };
    }

    return { ok: true, status, finalUrl, contentType };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug("range-probe", {
      status: "error",
      url,
      elapsedMs: Date.now() - started,
      meta: { error: message },
    });
    return { ok: false, error: message };
  }
}

const PanoptoMediaResolver = {
  async resolve({ tenant, deliveryId, viewerUrl, embedUrl, tabId, jobId }) {
    const resolvedJobId =
      jobId || `panopto-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const debugEnabled = isPanoptoResolverDebugEnabled();
    const logger = createPanoptoResolverLogger(resolvedJobId, debugEnabled);
    const debugPayload = {
      jobId: resolvedJobId,
      candidates: [],
      signals: {},
    };

    let resolvedTenant = tenant;
    let resolvedDeliveryId = deliveryId;
    let resolvedViewerUrl = viewerUrl;
    let resolvedEmbedUrl = embedUrl;

    if (!resolvedViewerUrl || !resolvedTenant || !resolvedDeliveryId) {
      const info = extractPanoptoInfoFromUrl(embedUrl || viewerUrl);
      if (info) {
        resolvedTenant = resolvedTenant || info.tenant;
        resolvedDeliveryId = resolvedDeliveryId || info.deliveryId;
      }
    }

    if (!resolvedViewerUrl && resolvedTenant && resolvedDeliveryId) {
      resolvedViewerUrl = buildPanoptoViewerUrl(
        resolvedTenant,
        resolvedDeliveryId
      );
    }

    if (!resolvedEmbedUrl && resolvedTenant && resolvedDeliveryId) {
      resolvedEmbedUrl = buildPanoptoEmbedUrl(
        resolvedTenant,
        resolvedDeliveryId
      );
    }

    const primaryUrl = resolvedViewerUrl || resolvedEmbedUrl;
    if (!primaryUrl) {
      return {
        ok: false,
        errorCode: "INVALID_VIDEO",
        message: "Panopto viewer URL not available.",
        debug: debugEnabled ? debugPayload : undefined,
      };
    }

    logger.info("start", { status: "begin", url: primaryUrl });

    let podcastDisabled = false;
    let downloadEnabled = false;
    let disabledReason = null;
    let authRequired = false;

    const candidates = [];
    const collectFromHtml = async (url, step) => {
      const started = Date.now();
      try {
        const html = await fetchWithCredentials(url);
        const result = extractPanoptoMediaCandidatesFromHtml(html, url);
        candidates.push(...result.candidates);
        if (result.podcastDisabled) {
          podcastDisabled = true;
          disabledReason = result.disabledReason || disabledReason;
        }
        if (result.downloadEnabled) {
          downloadEnabled = true;
        }
        logger.debug(step, {
          status: "ok",
          url,
          elapsedMs: Date.now() - started,
          meta: {
            candidateCount: result.candidates.length,
            podcastDisabled: result.podcastDisabled,
            downloadEnabled: result.downloadEnabled,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "AUTH_REQUIRED") {
          authRequired = true;
        }
        logger.debug(step, {
          status: "error",
          url,
          elapsedMs: Date.now() - started,
          meta: { error: message },
        });
      }
    };

    if (resolvedViewerUrl) {
      await collectFromHtml(resolvedViewerUrl, "viewer-html");
    }
    if (resolvedEmbedUrl && resolvedEmbedUrl !== resolvedViewerUrl) {
      await collectFromHtml(resolvedEmbedUrl, "embed-html");
    }

    if (candidates.length === 0) {
      const runtime = await runPanoptoRuntimeProbe(tabId, logger);
      candidates.push(...runtime.candidates);
      if (runtime.podcastDisabled) {
        podcastDisabled = true;
        disabledReason = runtime.disabledReason || disabledReason;
      }
      if (runtime.downloadEnabled) {
        downloadEnabled = true;
      }
    }

    if (resolvedTenant && resolvedDeliveryId) {
      const podcastDownloadUrl = buildPanoptoPodcastDownloadUrl(
        resolvedTenant,
        resolvedDeliveryId
      );
      if (podcastDownloadUrl) {
        candidates.push({
          url: podcastDownloadUrl,
          source: "derived:podcast-download",
        });
      }
    }

    const orderedCandidates = dedupeAndSortPanoptoCandidates(candidates);
    debugPayload.candidates = orderedCandidates.map((candidate) => ({
      url: truncateUrl(candidate.url),
      source: candidate.source,
    }));
    debugPayload.signals = {
      podcastDisabled,
      downloadEnabled,
      disabledReason,
      authRequired,
      viewerUrl: truncateUrl(resolvedViewerUrl),
      embedUrl: truncateUrl(resolvedEmbedUrl),
    };

    if (orderedCandidates.length === 0) {
      if (podcastDisabled) {
        logger.warn("resolve", {
          status: "podcast-disabled",
          url: primaryUrl,
          meta: { disabledReason },
        });
        return {
          ok: false,
          errorCode: "PODCAST_DISABLED",
          message:
            "Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.",
          debug: debugEnabled ? debugPayload : undefined,
        };
      }
      if (authRequired) {
        return {
          ok: false,
          errorCode: "AUTH_REQUIRED",
          message:
            "Authentication required. Please log in to Panopto and try again.",
          debug: debugEnabled ? debugPayload : undefined,
        };
      }
      return {
        ok: false,
        errorCode: "NOT_AVAILABLE",
        message:
          "No downloadable media URL found. This video may not allow downloads.",
        debug: debugEnabled ? debugPayload : undefined,
      };
    }

    for (const candidate of orderedCandidates) {
      const probe = await probePanoptoMediaUrl(candidate.url, logger);
      if (probe.ok) {
        logger.info("resolve", {
          status: "ok",
          url: candidate.url,
          finalUrl: probe.finalUrl,
        });
        return {
          ok: true,
          mediaUrl: probe.finalUrl || candidate.url,
          mime: probe.contentType || null,
          method: candidate.source || "unknown",
          debug: debugEnabled ? debugPayload : undefined,
        };
      }

      if (probe.errorCode === "AUTH_REQUIRED") {
        logger.warn("resolve", {
          status: "auth-required",
          url: candidate.url,
        });
        return {
          ok: false,
          errorCode: "AUTH_REQUIRED",
          message:
            "Authentication required to access this Panopto download. Please log in and try again.",
          debug: debugEnabled ? debugPayload : undefined,
        };
      }

      if (probe.status === 403 && podcastDisabled) {
        logger.warn("resolve", {
          status: "podcast-disabled",
          url: candidate.url,
          meta: { disabledReason },
        });
        return {
          ok: false,
          errorCode: "PODCAST_DISABLED",
          message:
            "Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.",
          debug: debugEnabled ? debugPayload : undefined,
        };
      }
    }

    if (podcastDisabled) {
      return {
        ok: false,
        errorCode: "PODCAST_DISABLED",
        message:
          "Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.",
        debug: debugEnabled ? debugPayload : undefined,
      };
    }

    return {
      ok: false,
      errorCode: "NOT_ALLOWED",
      message:
        "Panopto denied access to the download URL. Downloads may be disabled for your account.",
      debug: debugEnabled ? debugPayload : undefined,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Network Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Default retry configuration */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  timeoutMs: 30000, // 30 second timeout
};

/**
 * Delay for exponential backoff
 * @param {number} attempt - Current attempt (0-based)
 * @returns {Promise<void>}
 */
function backoffDelay(attempt) {
  const delay = Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Determine if an error is retryable
 * @param {Error} error - The error to check
 * @param {Response} response - The response object if available
 * @returns {boolean}
 */
function isRetryableError(error, response) {
  // Don't retry auth errors - user needs to sign in
  if (response && (response.status === 401 || response.status === 403)) {
    return false;
  }
  // Don't retry 404 - resource doesn't exist
  if (response && response.status === 404) {
    return false;
  }
  // Retry network errors and 5xx server errors
  if (!response || response.status >= 500) {
    return true;
  }
  // Retry rate limiting (429)
  if (response.status === 429) {
    return true;
  }
  return false;
}

/**
 * Fetch with retry and exponential backoff
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default from config)
 * @param {number} timeoutMs - Request timeout in milliseconds (default from config)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(
  url,
  options = {},
  maxRetries = RETRY_CONFIG.maxRetries,
  timeoutMs = RETRY_CONFIG.timeoutMs
) {
  let lastError;
  let lastResponse;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Merge abort signal with existing options
      const fetchOptions = {
        ...options,
        signal: controller.signal,
      };

      console.log(`[Lock-in] Fetching (attempt ${attempt + 1}/${maxRetries + 1}): ${url.substring(0, 100)}...`);
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      lastResponse = response;

      console.log(`[Lock-in] Response status: ${response.status} ${response.statusText}`);

      // If successful or non-retryable error, return
      if (response.ok || !isRetryableError(null, response)) {
        return response;
      }

      // Retryable error
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
      console.error(`[Lock-in] Fetch error (attempt ${attempt + 1}):`, error.message || error);
      
      // Specific error handling for better debugging
      if (error.name === 'AbortError') {
        console.warn(`[Lock-in] Request timeout after ${timeoutMs}ms`);
        lastError = new Error(`Request timeout after ${timeoutMs}ms`);
      } else if (error.message === 'Failed to fetch') {
        console.warn('[Lock-in] Network error: Failed to fetch. Possible causes: CORS, DNS, or network connectivity');
      }
      
      // Network errors are retryable
      if (attempt < maxRetries) {
        console.log(`[Lock-in] Retrying in ${RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)}ms...`);
        await backoffDelay(attempt);
        continue;
      }
    }

    // If this wasn't the last attempt, wait and retry
    if (attempt < maxRetries && isRetryableError(lastError, lastResponse)) {
      console.log(`[Lock-in] Retrying in ${RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)}ms...`);
      await backoffDelay(attempt);
    }
  }

  // Return last response if we have one, otherwise throw
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

/**
 * Fetch HTML with credentials (with retry)
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
async function fetchWithCredentials(url) {
  console.log('[Lock-in] fetchWithCredentials:', url.substring(0, 100));
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    console.error('[Lock-in] Invalid URL:', url, e);
    throw new Error('Invalid URL provided');
  }

  const response = await fetchWithRetry(url, {
    method: "GET",
    credentials: "include",
    mode: "cors", // Explicitly set CORS mode
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (Chrome Extension)",
    },
  });

  if (!response.ok) {
    console.error(`[Lock-in] Response not OK: ${response.status} ${response.statusText}`);
    if (response.status === 401 || response.status === 403) {
      throw new Error("AUTH_REQUIRED");
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const text = await response.text();
  console.log(`[Lock-in] Fetched ${text.length} bytes successfully`);
  return text;
}

/**
 * Fetch VTT content (with retry)
 * @param {string} url - Caption VTT URL
 * @returns {Promise<string>} VTT content
 */
async function fetchVttContent(url) {
  console.log('[Lock-in] fetchVttContent:', url.substring(0, 100));
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    console.error('[Lock-in] Invalid caption URL:', url, e);
    throw new Error('Invalid caption URL');
  }

  const response = await fetchWithRetry(url, {
    method: "GET",
    credentials: "include",
    mode: "cors", // Explicitly set CORS mode
    headers: { 
      Accept: "text/vtt,text/plain,*/*",
      "User-Agent": "Mozilla/5.0 (Chrome Extension)",
    },
  });

  if (!response.ok) {
    console.error(`[Lock-in] VTT fetch failed: ${response.status} ${response.statusText}`);
    if (response.status === 401 || response.status === 403) {
      throw new Error("AUTH_REQUIRED");
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const text = await response.text();
  console.log(`[Lock-in] Fetched VTT: ${text.length} bytes`);
  return text;
}

/**
 * Extract transcript from a Panopto video
 */
async function extractPanoptoTranscript(video) {
  console.log('[Lock-in] extractPanoptoTranscript starting for:', {
    id: video.id,
    title: video.title,
    embedUrl: video.embedUrl,
  });

  try {
    // Validate video embedUrl
    if (!video.embedUrl) {
      console.error('[Lock-in] No embedUrl provided for Panopto video');
      return {
        success: false,
        error: "No video URL provided",
        errorCode: "INVALID_VIDEO",
        aiTranscriptionAvailable: true,
      };
    }

    // Step 1: Fetch the embed page HTML
    console.log('[Lock-in] Step 1: Fetching embed page...');
    const embedHtml = await fetchWithCredentials(video.embedUrl);
    console.log('[Lock-in] Embed page fetched successfully, length:', embedHtml.length);

    // Step 2: Extract caption URL from the HTML
    console.log('[Lock-in] Step 2: Extracting caption URL...');
    const captionUrl = extractCaptionVttUrl(embedHtml);

    if (!captionUrl) {
      console.warn('[Lock-in] No caption URL found in embed page');
      return {
        success: false,
        error: "No captions available for this video",
        errorCode: "NO_CAPTIONS",
        aiTranscriptionAvailable: true,
      };
    }
    console.log('[Lock-in] Caption URL found:', captionUrl.substring(0, 100));

    // Step 3: Fetch the VTT content
    console.log('[Lock-in] Step 3: Fetching VTT content...');
    const vttContent = await fetchVttContent(captionUrl);
    console.log('[Lock-in] VTT content fetched successfully, length:', vttContent.length);

    // Step 4: Parse the VTT
    console.log('[Lock-in] Step 4: Parsing VTT content...');
    const transcript = parseWebVtt(vttContent);

    if (transcript.segments.length === 0) {
      console.warn('[Lock-in] Parsed transcript has no segments');
      return {
        success: false,
        error: "Caption file is empty or could not be parsed",
        errorCode: "PARSE_ERROR",
        aiTranscriptionAvailable: true,
      };
    }

    console.log('[Lock-in] Transcript extracted successfully:', {
      segments: transcript.segments.length,
      plainTextLength: transcript.plainText?.length || 0,
      durationMs: transcript.durationMs,
    });

    return { success: true, transcript };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Lock-in] extractPanoptoTranscript error:', message, error);

    // Auth error
    if (message === "AUTH_REQUIRED") {
      return {
        success: false,
        error: "Authentication required. Please log in to Panopto.",
        errorCode: "AUTH_REQUIRED",
        aiTranscriptionAvailable: true,
      };
    }

    // Timeout error
    if (message.includes("timeout") || message.includes("AbortError")) {
      return {
        success: false,
        error: "Request timeout. The server took too long to respond.",
        errorCode: "TIMEOUT",
        aiTranscriptionAvailable: true,
      };
    }

    // Network/CORS errors
    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("CORS") ||
      message.includes("Network request failed")
    ) {
      console.error('[Lock-in] Network error details:', {
        message,
        embedUrl: video.embedUrl,
        error: error.toString(),
      });
      return {
        success: false,
        error: "Network error. Please check your internet connection and ensure you're logged into Panopto.",
        errorCode: "NETWORK_ERROR",
        aiTranscriptionAvailable: true,
      };
    }

    // Generic error
    return {
      success: false,
      error: `Failed to extract transcript: ${message}`,
      errorCode: "PARSE_ERROR",
      aiTranscriptionAvailable: true,
    };
  }
}

/**
 * Extract transcript from an HTML5 video using track URLs
 */
async function extractHtml5Transcript(video) {
  console.log(
    "[Lock-in BG] extractHtml5Transcript called for video:",
    video.id,
    video.title
  );
  const tracks = Array.isArray(video.trackUrls) ? video.trackUrls : [];
  console.log(
    "[Lock-in BG] Track URLs found:",
    tracks.length,
    tracks.map((t) => t?.src)
  );

  if (tracks.length === 0) {
    console.log("[Lock-in BG] No caption tracks available for HTML5 video");
    return {
      success: false,
      error: "No captions found",
      errorCode: "NO_CAPTIONS",
      aiTranscriptionAvailable: true,
    };
  }

  let lastError = null;

  for (const track of tracks) {
    if (!track || !track.src) continue;
    try {
      const vttContent = await fetchVttContent(track.src);
      const transcript = parseWebVtt(vttContent);

      if (transcript.segments.length > 0) {
        return { success: true, transcript };
      }

      lastError = {
        error: "Caption file is empty or could not be parsed",
        errorCode: "PARSE_ERROR",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === "AUTH_REQUIRED") {
        return {
          success: false,
          error: "Authentication required to access captions.",
          errorCode: "AUTH_REQUIRED",
          aiTranscriptionAvailable: true,
        };
      }

      if (
        message.includes("Failed to fetch") ||
        message.includes("NetworkError")
      ) {
        lastError = {
          error:
            "Captions could not be fetched due to browser restrictions or network errors.",
          errorCode: "NOT_AVAILABLE",
        };
      } else {
        lastError = {
          error: `Failed to fetch captions: ${message}`,
          errorCode: "NOT_AVAILABLE",
        };
      }
    }
  }

  if (lastError) {
    return {
      success: false,
      error: lastError.error,
      errorCode: lastError.errorCode,
      aiTranscriptionAvailable: true,
    };
  }

  return {
    success: false,
    error: "No captions found",
    errorCode: "NO_CAPTIONS",
    aiTranscriptionAvailable: true,
  };
}
/**
 * Handle transcript extraction for supported providers.
 */
async function handleTranscriptExtraction(video) {
  console.log("[Lock-in BG] handleTranscriptExtraction called");
  if (!video || !video.provider) {
    return {
      success: false,
      error: "No video provider specified",
      errorCode: "INVALID_VIDEO",
      aiTranscriptionAvailable: true,
    };
  }

  switch (video.provider) {
    case "panopto": {
      console.log("[Lock-in BG] Handling Panopto video");
      const result = await extractPanoptoTranscript(video);
      console.log("[Lock-in BG] Panopto result:", result.success);
      return result;
    }
    case "html5": {
      console.log("[Lock-in BG] Handling HTML5 video");
      const result = await extractHtml5Transcript(video);
      console.log("[Lock-in BG] HTML5 result:", result.success);
      return result;
    }
    default:
      return {
        success: false,
        error: `Unsupported video provider: ${video.provider}`,
        errorCode: "NOT_AVAILABLE",
        aiTranscriptionAvailable: true,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Transcription Helpers
// ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?

const AI_TRANSCRIPTION_JOBS = new Map();

/**
 * Fetch media URL from Panopto video for AI transcription
 * @param {Object} video - DetectedVideo object
 * @returns {Promise<Object>} - { success, mediaUrl?, error? }
 */
async function handlePanoptoMediaUrlFetch(video, options = {}) {
  console.log("[Lock-in BG] Fetching Panopto media URL for AI transcription");
  console.log("[Lock-in BG] Video:", {
    id: video.id,
    provider: video.provider,
    embedUrl: video.embedUrl,
    panoptoTenant: video.panoptoTenant,
  });

  if (video.provider !== "panopto") {
    return {
      success: false,
      error: "Not a Panopto video",
    };
  }

  try {
    const tabId = options?.tabId || null;
    const resolverResult = await PanoptoMediaResolver.resolve({
      tenant: video.panoptoTenant,
      deliveryId: video.id,
      embedUrl: video.embedUrl,
      tabId,
    });
    console.log(
      "[Lock-in BG] Panopto media URL fetch (v2) result:",
      resolverResult.ok
    );
    return {
      success: resolverResult.ok,
      mediaUrl: resolverResult.mediaUrl,
      mime: resolverResult.mime,
      method: resolverResult.method,
      error: resolverResult.message,
      errorCode: resolverResult.errorCode,
      debug: resolverResult.debug,
    };
  } catch (error) {
    console.error("[Lock-in BG] Error fetching Panopto media URL:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch media URL",
    };
  }
}

const AI_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
const AI_POLL_INTERVAL_MS = 3000;
const AI_POLL_MAX_ATTEMPTS = 160;

function getConfigValue(key, fallback) {
  if (typeof self === "undefined" || !self.LOCKIN_CONFIG) {
    return fallback;
  }
  const value = self.LOCKIN_CONFIG[key];
  return value === undefined || value === null || value === ""
    ? fallback
    : value;
}

function getBackendUrl() {
  return getConfigValue("BACKEND_URL", "http://localhost:3000");
}

function getSessionStorageKey() {
  return getConfigValue("SESSION_STORAGE_KEY", "lockinSupabaseSession");
}

async function getAuthToken() {
  const key = getSessionStorageKey();
  try {
    const result = await chrome.storage.sync.get([key]);
    const session = result[key];
    if (!session) return null;
    return session.accessToken || session.access_token || null;
  } catch (error) {
    console.error("[Lock-in] Failed to read auth session:", error);
    return null;
  }
}

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "gclid",
  "dclid",
  "fbclid",
  "msclkid",
  "yclid",
  "igshid",
  "_ga",
  "_gid",
  "_gac",
  "_gl",
  "mc_cid",
  "mc_eid",
  "hsa_acc",
  "hsa_cam",
  "hsa_grp",
  "hsa_ad",
  "hsa_src",
  "hsa_tgt",
  "hsa_kw",
  "hsa_mt",
  "hsa_net",
  "hsa_ver",
]);

function normalizeMediaUrl(mediaUrl) {
  if (!mediaUrl) return "";
  try {
    const url = new URL(mediaUrl);
    url.hash = "";
    const params = url.searchParams;
    for (const key of Array.from(params.keys())) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith("utm_") || TRACKING_QUERY_KEYS.has(lowerKey)) {
        params.delete(key);
      }
    }
    const nextSearch = params.toString();
    url.search = nextSearch ? `?${nextSearch}` : "";
    return url.toString();
  } catch {
    return mediaUrl;
  }
}

function isAuthStatus(status) {
  return status === 401 || status === 403;
}

function isBlobUrl(mediaUrl) {
  return typeof mediaUrl === "string" && mediaUrl.startsWith("blob:");
}

function createErrorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getErrorCode(error) {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

async function fetchMediaHeadMetadata(mediaUrl, signal) {
  try {
    const response = await fetchWithRetry(mediaUrl, {
      method: "HEAD",
      credentials: "include",
      signal,
    });

    if (isAuthStatus(response.status)) {
      return { authRequired: true };
    }

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    if (response.type === "opaque") {
      return { ok: false, opaque: true };
    }

    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");
    const contentLength = response.headers.get("content-length");
    return {
      ok: true,
      etag: etag ? etag.trim() : "",
      lastModified: lastModified ? lastModified.trim() : "",
      contentLength: contentLength ? contentLength.trim() : "",
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
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
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return fallbackHash(value);
  }
  const encoded = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function createProgressEmitter(tabId, requestId) {
  let lastStage = null;
  let lastPercentBucket = null;

  return (stage, info = {}) => {
    if (!tabId) return;

    const percent =
      typeof info.percent === "number"
        ? Math.max(0, Math.min(100, info.percent))
        : undefined;
    const percentBucket =
      typeof percent === "number" ? Math.floor(percent) : null;
    const shouldSkip =
      stage === lastStage &&
      percentBucket !== null &&
      percentBucket === lastPercentBucket &&
      !info.message;

    if (shouldSkip) return;

    lastStage = stage;
    if (percentBucket !== null) {
      lastPercentBucket = percentBucket;
    }

    try {
      chrome.tabs.sendMessage(tabId, {
        type: "TRANSCRIBE_MEDIA_AI_PROGRESS",
        payload: {
          requestId,
          jobId: info.jobId || null,
          stage,
          message: info.message || null,
          percent,
        },
      });
    } catch (error) {
      console.warn("[Lock-in] Failed to send progress update:", error);
    }
  };
}

async function fetchJsonWithAuth(url, token, options = {}) {
  const headers = Object.assign({}, options.headers || {}, {
    Authorization: `Bearer ${token}`,
  });

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // Extract error message - handle both string and object error formats
    let message = "Request failed";
    if (data?.error?.message) {
      message = data.error.message;
    } else if (typeof data?.error === "string") {
      message = data.error;
    } else if (typeof data?.message === "string") {
      message = data.message;
    } else if (response.statusText) {
      message = response.statusText;
    }
    const error = new Error(message);
    if (data?.error?.code) {
      error.code = data.error.code;
    }
    if (data?.error?.details) {
      error.details = data.error.details;
    }
    error.status = response.status;
    throw error;
  }

  return data;
}

async function createTranscriptionJob({ token, payload, signal }) {
  const backendUrl = getBackendUrl();
  return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Script Media Fetcher (CORS Fallback)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Storage for pending media chunks from content script
 */
const pendingMediaChunks = new Map();

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Request content script to fetch media and stream it back
 * This is used as a fallback when CORS blocks direct fetching from background
 *
 * @param {number} tabId - The tab ID to send the request to
 * @param {string} mediaUrl - The URL of the media to fetch
 * @param {string} jobId - The transcription job ID
 * @param {string} requestId - The request ID for tracking
 * @param {function} onChunk - Callback for each chunk received
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function fetchMediaViaContentScript({
  tabId,
  mediaUrl,
  jobId,
  requestId,
  onChunk,
}) {
  console.log(
    "[Lock-in BG] Requesting content script to fetch media:",
    mediaUrl
  );

  // Set up chunk receiver
  let resolveComplete;
  let rejectComplete;
  const completePromise = new Promise((resolve, reject) => {
    resolveComplete = resolve;
    rejectComplete = reject;
  });

  // Store the chunk handler for this request
  pendingMediaChunks.set(requestId, {
    onChunk,
    resolve: resolveComplete,
    reject: rejectComplete,
  });

  try {
    // Send request to content script - this kicks off the fetch
    // The content script will send chunks via separate MEDIA_CHUNK messages
    const result = await chrome.tabs.sendMessage(tabId, {
      type: "FETCH_MEDIA_FOR_TRANSCRIPTION",
      payload: { mediaUrl, jobId, requestId },
    });

    console.log("[Lock-in BG] Content script fetch result:", result);

    if (!result || !result.success) {
      throw createErrorWithCode(
        result?.error || "Content script failed to fetch media",
        result?.errorCode || "CONTENT_FETCH_ERROR"
      );
    }

    // Wait for all chunks to be processed
    // The handleMediaChunkMessage will resolve this when isLast=true
    console.log("[Lock-in BG] Waiting for all chunks to be uploaded...");
    await completePromise;
    console.log("[Lock-in BG] All chunks uploaded successfully");

    return result;
  } catch (error) {
    console.error("[Lock-in BG] Content script media fetch error:", error);
    throw error;
  } finally {
    pendingMediaChunks.delete(requestId);
  }
}

/**
 * Handle MEDIA_CHUNK messages from content script
 */
function handleMediaChunkMessage(message) {
  const { requestId, chunkIndex, chunkData, chunkSize, isLast } =
    message.payload || {};

  const handler = pendingMediaChunks.get(requestId);
  if (!handler) {
    console.warn("[Lock-in BG] Received chunk for unknown request:", requestId);
    return;
  }

  console.log(
    "[Lock-in BG] Received chunk:",
    chunkIndex,
    "size:",
    chunkSize,
    "isLast:",
    isLast
  );

  // Convert base64 to Uint8Array
  const chunkBytes = base64ToArrayBuffer(chunkData);

  // Call the chunk handler
  handler
    .onChunk(chunkBytes, chunkIndex, isLast)
    .then(() => {
      if (isLast) {
        handler.resolve({ success: true });
      }
    })
    .catch((error) => {
      handler.reject(error);
    });
}

async function uploadMediaInChunks({
  jobId,
  mediaUrl,
  token,
  signal,
  onProgress,
  tabId,
  requestId,
}) {
  const backendUrl = getBackendUrl();
  let uploadedBytes = 0;
  let chunkIndex = 0;

  // Helper to send a chunk to the backend with retry logic for rate limits
  const sendChunkToBackend = async (chunk, index, maxRetries = 5) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "x-chunk-index": String(index),
    };

    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error("CANCELED");
      }

      const response = await fetch(
        `${backendUrl}/api/transcripts/jobs/${jobId}/chunks`,
        {
          method: "PUT",
          headers,
          body: chunk,
          signal,
        }
      );

      if (response.ok) {
        return response.json();
      }

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        let retryAfterMs;

        if (retryAfterHeader) {
          retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          retryAfterMs = Math.min(2000 * Math.pow(2, attempt), 32000);
        }

        console.log(
          `[Lock-in BG] Rate limited on chunk ${index}, retrying in ${retryAfterMs}ms (attempt ${
            attempt + 1
          }/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }
      lastError = new Error(
        data?.error?.message ||
          data?.error ||
          `Chunk upload failed: ${response.status}`
      );
      break;
    }

    throw (
      lastError ||
      new Error(`Chunk ${index} upload failed after ${maxRetries} retries`)
    );
  };

  // Known SSO domains that indicate session expiration
  const SSO_DOMAINS = [
    "okta.com",
    "auth0.com",
    "login.microsoftonline.com",
    "accounts.google.com",
  ];

  const isSsoRedirect = (url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return SSO_DOMAINS.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  };

  const isCdnUrl = (url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname.includes("cloudfront.net") ||
        hostname.includes("cdn.") ||
        hostname.includes("akamai") ||
        hostname.includes("fastly") ||
        hostname.includes("cloudflare")
      );
    } catch {
      return false;
    }
  };

  // First try direct fetch from background script
  let response;
  let usedContentScript = false;

  try {
    console.log("[Lock-in BG] Attempting direct media fetch:", mediaUrl);

    // Use manual redirect to handle Moodle → CDN redirects properly
    // Moodle needs credentials, CDN doesn't (and CDN returns Access-Control-Allow-Origin: *)
    response = await fetch(mediaUrl, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      signal,
    });

    console.log(
      "[Lock-in BG] Initial response:",
      response.status,
      response.type
    );

    // Handle redirects manually
    if (
      response.type === "opaqueredirect" ||
      response.status === 0 ||
      (response.status >= 300 && response.status < 400)
    ) {
      const location = response.headers.get("location");
      console.log("[Lock-in BG] Redirect detected, location:", location);

      if (location) {
        // Check for SSO redirect (session expired)
        if (isSsoRedirect(location)) {
          throw createErrorWithCode(
            "Your session has expired. Please refresh the page and log in again.",
            "SESSION_EXPIRED"
          );
        }

        // Follow redirect with appropriate credentials
        const useCredentials = !isCdnUrl(location);
        console.log(
          "[Lock-in BG] Following redirect, credentials:",
          useCredentials
        );

        response = await fetch(location, {
          method: "GET",
          credentials: useCredentials ? "include" : "omit",
          signal,
        });
      } else {
        // Can't get location - fall back to content script
        console.log(
          "[Lock-in BG] No location header, falling back to content script"
        );
        throw createErrorWithCode("CORS_BLOCKED", "CORS_BLOCKED");
      }
    }

    // Check for CORS/opaque issues
    if (response.type === "opaque") {
      console.log(
        "[Lock-in BG] Got opaque response, will try content script fallback"
      );
      throw createErrorWithCode("CORS_BLOCKED", "CORS_BLOCKED");
    }

    if (!response.ok) {
      if (isAuthStatus(response.status)) {
        throw createErrorWithCode(
          "Authentication required. Please refresh the page and log in.",
          "AUTH_REQUIRED"
        );
      }
      throw createErrorWithCode(`HTTP ${response.status}`, "FETCH_ERROR");
    }

    console.log("[Lock-in BG] Direct fetch successful");
  } catch (error) {
    // Check if we should try content script fallback
    const shouldFallback =
      error?.code === "CORS_BLOCKED" ||
      error?.code === "NOT_AVAILABLE" ||
      (error?.message &&
        (error.message.includes("CORS") ||
          error.message.includes("opaque") ||
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError")));

    if (shouldFallback && tabId) {
      console.log(
        "[Lock-in BG] Trying content script fallback for media fetch"
      );
      usedContentScript = true;

      try {
        // Use content script to fetch and upload chunks
        await fetchMediaViaContentScript({
          tabId,
          mediaUrl,
          jobId,
          requestId,
          onChunk: async (chunkBytes, index, isLast) => {
            await sendChunkToBackend(chunkBytes, index);
            uploadedBytes += chunkBytes.length;
            if (onProgress) {
              onProgress({ bytesUploaded: uploadedBytes, chunkIndex: index });
            }
            chunkIndex = index + 1;
          },
        });

        // Return consistent property names with direct fetch path
        // chunkIndex is now the total count (0-indexed + 1 after each chunk)
        return {
          chunkCount: chunkIndex,
          totalChunks: chunkIndex, // We know exact count after streaming completes
          totalBytes: uploadedBytes,
          usedContentScript: true,
        };
      } catch (contentError) {
        console.error(
          "[Lock-in BG] Content script fallback failed:",
          contentError
        );
        throw createErrorWithCode(
          contentError?.message ||
            "Media could not be fetched via content script.",
          contentError?.code || "CONTENT_FETCH_ERROR"
        );
      }
    }

    // Re-throw original error if we can't fallback
    if (error?.name === "AbortError") throw error;
    if (error?.code) throw error;

    throw createErrorWithCode(
      "Media could not be fetched due to browser restrictions (CORS/opaque response) or network errors.",
      "NOT_AVAILABLE"
    );
  }

  // Process the direct fetch response
  if (!response.body || typeof response.body.getReader !== "function") {
    throw createErrorWithCode(
      "Streaming not supported for this media.",
      "NOT_AVAILABLE"
    );
  }

  const totalBytesHeader = response.headers.get("content-length");
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
  const totalChunks =
    Number.isFinite(totalBytes) && totalBytes > 0
      ? Math.ceil(totalBytes / AI_UPLOAD_CHUNK_BYTES)
      : null;

  const reader = response.body.getReader();
  let pending = new Uint8Array(0);

  // sendChunk with retry logic for rate limits (direct fetch path)
  const sendChunk = async (chunk, maxRetries = 5) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "x-chunk-index": String(chunkIndex),
    };
    if (totalChunks) {
      headers["x-total-chunks"] = String(totalChunks);
    }

    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error("CANCELED");
      }

      const uploadResponse = await fetch(
        `${backendUrl}/api/transcripts/jobs/${jobId}/chunks`,
        {
          method: "PUT",
          headers,
          body: chunk,
          signal,
        }
      );

      if (uploadResponse.ok) {
        chunkIndex += 1;
        return;
      }

      // Handle rate limiting with exponential backoff
      if (uploadResponse.status === 429) {
        const retryAfterHeader = uploadResponse.headers.get("Retry-After");
        let retryAfterMs;

        if (retryAfterHeader) {
          retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          retryAfterMs = Math.min(2000 * Math.pow(2, attempt), 32000);
        }

        console.log(
          `[Lock-in BG] Rate limited on chunk ${chunkIndex}, retrying in ${retryAfterMs}ms (attempt ${
            attempt + 1
          }/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }

      const text = await uploadResponse.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }
      lastError = new Error(
        data?.error?.message ||
          data?.error ||
          `Failed to upload chunk ${chunkIndex}: ${uploadResponse.status}`
      );
      break;
    }

    throw (
      lastError ||
      new Error(`Chunk ${chunkIndex} upload failed after ${maxRetries} retries`)
    );
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    const combined = new Uint8Array(pending.length + value.length);
    combined.set(pending);
    combined.set(value, pending.length);
    pending = combined;

    while (pending.length >= AI_UPLOAD_CHUNK_BYTES) {
      const chunk = pending.slice(0, AI_UPLOAD_CHUNK_BYTES);
      pending = pending.slice(AI_UPLOAD_CHUNK_BYTES);
      await sendChunk(chunk);
      uploadedBytes += chunk.length;
      if (totalBytes) {
        const percent = Math.round((uploadedBytes / totalBytes) * 100);
        if (onProgress) {
          onProgress({ percent });
        }
      } else if (onProgress && chunkIndex % 5 === 0) {
        onProgress({ message: `Uploaded ${chunkIndex} chunks` });
      }
    }
  }

  if (pending.length > 0) {
    await sendChunk(pending);
    uploadedBytes += pending.length;
    if (totalBytes && onProgress) {
      const percent = Math.round((uploadedBytes / totalBytes) * 100);
      onProgress({ percent });
    }
  }

  return {
    chunkCount: chunkIndex,
    totalChunks,
    totalBytes,
  };
}

async function finalizeTranscriptionJob({
  jobId,
  token,
  options,
  expectedTotalChunks,
  signal,
}) {
  const backendUrl = getBackendUrl();
  const payload = Object.assign({}, options || {});
  if (expectedTotalChunks) {
    payload.expectedTotalChunks = expectedTotalChunks;
  }
  return fetchJsonWithAuth(
    `${backendUrl}/api/transcripts/jobs/${jobId}/finalize`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    }
  );
}

async function pollTranscriptJob({ jobId, token, signal, onProgress }) {
  const backendUrl = getBackendUrl();
  for (let attempt = 0; attempt < AI_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new Error("CANCELED");
    }

    const data = await fetchJsonWithAuth(
      `${backendUrl}/api/transcripts/jobs/${jobId}`,
      token,
      { method: "GET", signal }
    );

    const job = data?.job || data;
    if (
      (job?.status === "done" || job?.status === "completed") &&
      job.transcript
    ) {
      return job.transcript;
    }
    if (job?.status === "error" || job?.status === "failed") {
      // Extract error message - handle both string and object error formats
      const errorMsg =
        typeof job.error === "string"
          ? job.error
          : job.error?.message || "AI transcription failed";
      throw new Error(errorMsg);
    }
    if (job?.status === "canceled") {
      throw new Error("CANCELED");
    }

    if (onProgress) {
      onProgress({ message: "Transcribing..." });
    }
    await new Promise((resolve) => setTimeout(resolve, AI_POLL_INTERVAL_MS));
  }

  throw new Error("AI transcription timed out");
}

async function cancelTranscriptJob({ jobId, token }) {
  if (!jobId || !token) return;
  const backendUrl = getBackendUrl();
  try {
    await fetchJsonWithAuth(
      `${backendUrl}/api/transcripts/jobs/${jobId}/cancel`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
  } catch (error) {
    console.warn("[Lock-in] Failed to cancel transcript job:", error);
  }
}

async function listActiveTranscriptJobs({ token }) {
  if (!token) throw new Error("No auth token provided");
  const backendUrl = getBackendUrl();
  return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/active`, token, {
    method: "GET",
  });
}

async function cancelAllActiveTranscriptJobs({ token }) {
  if (!token) throw new Error("No auth token provided");
  const backendUrl = getBackendUrl();
  return fetchJsonWithAuth(
    `${backendUrl}/api/transcripts/jobs/cancel-all`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
}

async function handleAiTranscriptionStart(payload, sender) {
  const video = payload?.video;
  const options = payload?.options || {};
  const requestId =
    payload?.requestId ||
    `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (!video || !video.mediaUrl) {
    return {
      success: false,
      error: "Media URL not available for AI transcription.",
      errorCode: "NOT_AVAILABLE",
      requestId,
    };
  }

  const tabId = sender?.tab?.id || null;
  const progress = createProgressEmitter(tabId, requestId);
  const abortController = new AbortController();

  const jobState = {
    requestId,
    jobId: null,
    abortController,
  };

  AI_TRANSCRIPTION_JOBS.set(requestId, jobState);
  progress("starting", { message: "Preparing AI transcription..." });

  try {
    if (isBlobUrl(video.mediaUrl)) {
      throw createErrorWithCode(
        "This video uses a blob URL and cannot be accessed for AI transcription.",
        "NOT_AVAILABLE"
      );
    }

    if (video.drmDetected) {
      const reason = video.drmReason ? ` (${video.drmReason})` : "";
      throw createErrorWithCode(
        `This video appears to be DRM-protected${reason}. AI transcription is not available.`,
        "NOT_AVAILABLE"
      );
    }

    const token = await getAuthToken();
    if (!token) {
      throw createErrorWithCode(
        "Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.",
        "LOCKIN_AUTH_REQUIRED"
      );
    }

    const mediaUrlNormalized = normalizeMediaUrl(video.mediaUrl);
    const headInfo = await fetchMediaHeadMetadata(
      video.mediaUrl,
      abortController.signal
    );
    if (headInfo?.authRequired) {
      throw createErrorWithCode(
        "Authentication required to access this media.",
        "AUTH_REQUIRED"
      );
    }

    const headContentLength = headInfo?.contentLength
      ? Number(headInfo.contentLength)
      : null;
    const expectedTotalChunks =
      Number.isFinite(headContentLength) && headContentLength > 0
        ? Math.ceil(headContentLength / AI_UPLOAD_CHUNK_BYTES)
        : null;

    const fingerprintSource = [
      mediaUrlNormalized,
      headInfo?.etag || "",
      headInfo?.lastModified || "",
      headInfo?.contentLength || "",
      video.durationMs || "",
    ].join("|");
    const fingerprint = await hashStringSha256(fingerprintSource);

    const jobResponse = await createTranscriptionJob({
      token,
      payload: {
        fingerprint,
        mediaUrl: video.mediaUrl,
        mediaUrlNormalized,
        durationMs: video.durationMs || null,
        provider: video.provider || "unknown",
        expectedTotalChunks,
      },
      signal: abortController.signal,
    });

    if (jobResponse?.job?.transcript) {
      progress("completed", { message: "Transcript ready." });
      return {
        success: true,
        transcript: jobResponse.job.transcript,
        jobId: jobResponse.job.id,
        status: "completed",
        cached: true,
        requestId,
      };
    }

    const jobId = jobResponse?.job?.id || jobResponse?.jobId;
    if (!jobId) {
      throw new Error("Failed to create transcription job");
    }

    jobState.jobId = jobId;
    progress("uploading", { jobId, message: "Uploading media..." });

    const uploadStats = await uploadMediaInChunks({
      jobId,
      mediaUrl: video.mediaUrl,
      token,
      signal: abortController.signal,
      onProgress: (info) => progress("uploading", { jobId, ...info }),
      tabId,
      requestId,
    });

    progress("processing", { jobId, message: "Processing audio..." });
    const expectedTotalChunksForFinalize =
      uploadStats?.totalChunks ||
      expectedTotalChunks ||
      uploadStats?.chunkCount ||
      null;
    await finalizeTranscriptionJob({
      jobId,
      token,
      options,
      expectedTotalChunks: expectedTotalChunksForFinalize,
      signal: abortController.signal,
    });

    progress("polling", { jobId, message: "Transcribing..." });
    const transcript = await pollTranscriptJob({
      jobId,
      token,
      signal: abortController.signal,
      onProgress: (info) => progress("polling", { jobId, ...info }),
    });

    progress("completed", { jobId, message: "Transcript ready." });
    return {
      success: true,
      transcript,
      jobId,
      status: "completed",
      requestId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = getErrorCode(error);
    const status = error?.status;
    if (abortController.signal.aborted || message === "CANCELED") {
      progress("canceled", { jobId: jobState.jobId, message: "Canceled." });
      return {
        success: false,
        error: "Transcription canceled.",
        errorCode: "CANCELED",
        jobId: jobState.jobId,
        status: "canceled",
        requestId,
      };
    }
    if (errorCode === "LOCKIN_AUTH_REQUIRED") {
      progress("failed", {
        jobId: jobState.jobId,
        message: "Lock-in sign-in required.",
      });
      return {
        success: false,
        error:
          "Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.",
        errorCode: "LOCKIN_AUTH_REQUIRED",
        jobId: jobState.jobId,
        status: "failed",
        requestId,
      };
    }
    if (
      errorCode === "AUTH_REQUIRED" ||
      message === "AUTH_REQUIRED" ||
      isAuthStatus(status)
    ) {
      progress("failed", {
        jobId: jobState.jobId,
        message: "Media authentication required.",
      });
      return {
        success: false,
        error:
          "Media authentication required. Please refresh the page and ensure you are logged in to the learning platform.",
        errorCode: "AUTH_REQUIRED",
        jobId: jobState.jobId,
        status: "failed",
        requestId,
      };
    }
    progress("failed", { jobId: jobState.jobId, message });
    return {
      success: false,
      error: message || "Failed to transcribe media.",
      errorCode: errorCode || "NOT_AVAILABLE",
      jobId: jobState.jobId,
      status: "failed",
      requestId,
    };
  } finally {
    AI_TRANSCRIPTION_JOBS.delete(requestId);
  }
}

async function handleAiTranscriptionCancel(payload) {
  const requestId = payload?.requestId;
  const jobId = payload?.jobId;

  const jobState = requestId ? AI_TRANSCRIPTION_JOBS.get(requestId) : null;
  if (jobState?.abortController) {
    jobState.abortController.abort();
  }

  const token = await getAuthToken();
  if (jobId && token) {
    await cancelTranscriptJob({ jobId, token });
  }

  return { success: true, requestId, jobId };
}

// Session management
const SESSION_STORAGE_PREFIX = "lockin_session_";

/**
 * Get session key for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {string}
 */
function getSessionKey(tabId) {
  return `${SESSION_STORAGE_PREFIX}${tabId}`;
}

/**
 * Get session for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object|null>}
 */
async function getSession(tabId) {
  if (!tabId) return null;

  const key = getSessionKey(tabId);
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  } catch (error) {
    console.error("Lock-in: Failed to get session:", error);
    return null;
  }
}

/**
 * Save session for a specific tab
 * @param {number} tabId - Tab ID
 * @param {Object} sessionData - Session data
 * @returns {Promise<void>}
 */
async function saveSession(tabId, sessionData) {
  if (!tabId) return;

  const key = getSessionKey(tabId);
  const storedSession = {
    ...(sessionData || {}),
    chatHistory: Array.isArray(sessionData?.chatHistory)
      ? sessionData.chatHistory
      : [],
    updatedAt: Date.now(),
  };

  try {
    await chrome.storage.local.set({ [key]: storedSession });
  } catch (error) {
    console.error("Lock-in: Failed to save session:", error);
  }
}

/**
 * Clear session for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
async function clearSession(tabId) {
  if (!tabId) return;

  const key = getSessionKey(tabId);
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error("Lock-in: Failed to clear session:", error);
  }
}

/**
 * Handle message from content script or popup
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender info
 * @returns {Promise<Object>}
 */
async function handleMessage(message, sender) {
  const tabId = sender.tab?.id;

  // Use messaging system if available, otherwise fall back to legacy format
  const messageType = message.type || message.action;

  try {
    switch (messageType) {
      case "getTabId":
      case "GET_TAB_ID": {
        return Messaging
          ? Messaging.createSuccessResponse({ tabId })
          : { tabId };
      }

      case "getSession":
      case "GET_SESSION": {
        const session = await getSession(tabId);
        return Messaging
          ? Messaging.createSuccessResponse({ session })
          : { session };
      }

      case "saveSession":
      case "SAVE_SESSION": {
        const sessionData = message.sessionData || message.payload?.sessionData;
        await saveSession(tabId, sessionData);
        return Messaging
          ? Messaging.createSuccessResponse({ success: true })
          : { success: true };
      }

      case "clearSession":
      case "CLEAR_SESSION": {
        await clearSession(tabId);
        return Messaging
          ? Messaging.createSuccessResponse({ success: true })
          : { success: true };
      }

      case "getSettings":
      case "GET_SETTINGS": {
        return new Promise((resolve) => {
          chrome.storage.sync.get(
            ["preferredLanguage", "difficultyLevel"],
            (data) => {
              resolve(Messaging ? Messaging.createSuccessResponse(data) : data);
            }
          );
        });
      }

      case "saveSettings":
      case "UPDATE_SETTINGS": {
        const settings = message.settings || message.payload?.settings || {};
        return new Promise((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve(
              Messaging
                ? Messaging.createSuccessResponse({ success: true })
                : { success: true }
            );
          });
        });
      }

      case "extractTranscript":
      case "EXTRACT_TRANSCRIPT": {
        console.log("[Lock-in BG] EXTRACT_TRANSCRIPT message received");
        const video = message.video || message.payload?.video;
        if (!video) {
          console.warn(
            "[Lock-in BG] No video provided in EXTRACT_TRANSCRIPT message"
          );
          return Messaging
            ? Messaging.createErrorResponse("No video provided")
            : { error: "No video provided" };
        }
        console.log(
          "[Lock-in BG] Processing EXTRACT_TRANSCRIPT for:",
          video.provider,
          video.id
        );
        const result = await handleTranscriptExtraction(video);
        console.log("[Lock-in BG] EXTRACT_TRANSCRIPT result:", result.success);
        return Messaging
          ? result.success
            ? Messaging.createSuccessResponse(result)
            : Messaging.createErrorResponse(
                result.error || "Failed to extract transcript",
                result
              )
          : result;
      }

      case "FETCH_PANOPTO_MEDIA_URL": {
        console.log("[Lock-in BG] FETCH_PANOPTO_MEDIA_URL message received");
        const video = message.video || message.payload?.video;
        if (!video) {
          console.warn(
            "[Lock-in BG] No video provided in FETCH_PANOPTO_MEDIA_URL message"
          );
          return Messaging
            ? Messaging.createErrorResponse("No video provided")
            : { success: false, error: "No video provided" };
        }
        console.log(
          "[Lock-in BG] Fetching media URL for:",
          video.provider,
          video.id
        );
        const result = await handlePanoptoMediaUrlFetch(video, { tabId });
        console.log("[Lock-in BG] FETCH_PANOPTO_MEDIA_URL result:", result.success);
        return Messaging
          ? result.success
            ? Messaging.createSuccessResponse(result)
            : Messaging.createErrorResponse(
                result.error || "Failed to fetch media URL",
                result
              )
          : result;
      }

      case "TRANSCRIBE_MEDIA_AI": {
        const action = message.action || message.payload?.action || "start";
        if (action === "cancel") {
          return handleAiTranscriptionCancel(message.payload || message);
        }
        const payload = message.payload || message;
        return handleAiTranscriptionStart(payload, sender);
      }

      case "MEDIA_CHUNK": {
        // Handle media chunks from content script
        handleMediaChunkMessage(message);
        return { received: true };
      }

      case "LIST_ACTIVE_TRANSCRIPT_JOBS": {
        const token = message.token || message.payload?.token;
        if (!token) {
          return Messaging
            ? Messaging.createErrorResponse("No auth token provided")
            : { success: false, error: "No auth token provided" };
        }
        try {
          const result = await listActiveTranscriptJobs({ token });
          return Messaging
            ? Messaging.createSuccessResponse(result)
            : { success: true, ...result };
        } catch (error) {
          return Messaging
            ? Messaging.createErrorResponse(error.message)
            : { success: false, error: error.message };
        }
      }

      case "CANCEL_ALL_ACTIVE_TRANSCRIPT_JOBS": {
        const token = message.token || message.payload?.token;
        if (!token) {
          return Messaging
            ? Messaging.createErrorResponse("No auth token provided")
            : { success: false, error: "No auth token provided" };
        }
        try {
          const result = await cancelAllActiveTranscriptJobs({ token });
          return Messaging
            ? Messaging.createSuccessResponse(result)
            : { success: true, ...result };
        } catch (error) {
          return Messaging
            ? Messaging.createErrorResponse(error.message)
            : { success: false, error: error.message };
        }
      }

      default: {
        const error = `Unknown message type: ${messageType}`;
        return Messaging ? Messaging.createErrorResponse(error) : { error };
      }
    }
  } catch (error) {
    console.error("Lock-in: Error handling message:", error);
    const errorMessage = error.message || String(error);
    return Messaging
      ? Messaging.createErrorResponse(errorMessage)
      : { error: errorMessage };
  }
}

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "lockin-process",
    title: "Lock-in: Explain",
    contexts: ["selection"],
  });

  console.log("Lock-in extension installed successfully!");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lockin-process" && info.selectionText) {
    // Send message to content script to show the mode selector
    chrome.tabs
      .sendMessage(tab.id, {
        type: "SHOW_MODE_SELECTOR",
        payload: {
          text: info.selectionText,
        },
      })
      .catch((error) => {
        console.error(
          "Lock-in: Failed to send message to content script:",
          error
        );
      });
  }
});

// Clean up session when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await clearSession(tabId);
  console.log(`Lock-in: Cleared session for closed tab ${tabId}`);
});

// Detect navigation to different origin and clear session
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only handle main frame navigation (not iframes)
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const newOrigin = new URL(details.url).origin;

  // Get existing session
  const session = await getSession(tabId);

  if (session && session.origin !== newOrigin) {
    // Origin changed, clear the session
    await clearSession(tabId);
    console.log(`Lock-in: Origin changed in tab ${tabId}, cleared session`);
  }
});

// Set up message listener
if (Messaging && typeof Messaging.setupMessageListener === "function") {
  Messaging.setupMessageListener(handleMessage);
} else {
  // Fallback to legacy message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse({ error: error.message || String(error) });
      });
    return true; // Keep channel open for async
  });
}

// Log when service worker starts
console.log("Lock-in background service worker started");
