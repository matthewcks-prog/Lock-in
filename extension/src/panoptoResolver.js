(() => {
  const NetworkUtils =
    typeof self !== 'undefined' && self.LockInNetworkUtils ? self.LockInNetworkUtils : null;
  const { fetchWithCredentials } = NetworkUtils || {};
  const TranscriptProviders =
    typeof self !== 'undefined' && self.LockInTranscriptProviders
      ? self.LockInTranscriptProviders
      : null;
  const { buildPanoptoEmbedUrl, buildPanoptoViewerUrl, extractPanoptoInfo } =
    TranscriptProviders || {};

  const Helpers =
    typeof self !== 'undefined' && self.LockInPanoptoResolverHelpers
      ? self.LockInPanoptoResolverHelpers
      : {};
  const Runtime =
    typeof self !== 'undefined' && self.LockInPanoptoResolverRuntime
      ? self.LockInPanoptoResolverRuntime
      : {};
  const Network =
    typeof self !== 'undefined' && self.LockInPanoptoResolverNetwork
      ? self.LockInPanoptoResolverNetwork
      : {};

  const {
    isPanoptoResolverDebugEnabled,
    createPanoptoResolverLogger,
    extractPanoptoMediaCandidatesFromHtml,
    dedupeAndSortPanoptoCandidates,
    buildPanoptoPodcastDownloadUrl,
    truncateUrl,
  } = Helpers;
  const { runPanoptoRuntimeProbe } = Runtime;
  const { probePanoptoMediaUrl } = Network;

  function resolvePanoptoContext({ tenant, deliveryId, viewerUrl, embedUrl }) {
    let resolvedTenant = tenant;
    let resolvedDeliveryId = deliveryId;
    let resolvedViewerUrl = viewerUrl;
    let resolvedEmbedUrl = embedUrl;

    if (!resolvedViewerUrl || !resolvedTenant || !resolvedDeliveryId) {
      const info = extractPanoptoInfo ? extractPanoptoInfo(embedUrl || viewerUrl || '') : null;
      if (info) {
        resolvedTenant = resolvedTenant || info.tenant;
        resolvedDeliveryId = resolvedDeliveryId || info.deliveryId;
      }
    }

    if (!resolvedViewerUrl && resolvedTenant && resolvedDeliveryId && buildPanoptoViewerUrl) {
      resolvedViewerUrl = buildPanoptoViewerUrl(resolvedTenant, resolvedDeliveryId);
    }

    if (!resolvedEmbedUrl && resolvedTenant && resolvedDeliveryId && buildPanoptoEmbedUrl) {
      resolvedEmbedUrl = buildPanoptoEmbedUrl(resolvedTenant, resolvedDeliveryId);
    }

    return {
      resolvedTenant,
      resolvedDeliveryId,
      resolvedViewerUrl,
      resolvedEmbedUrl,
      primaryUrl: resolvedViewerUrl || resolvedEmbedUrl,
    };
  }

  async function collectHtmlCandidates({ url, step, state, logger }) {
    const started = Date.now();
    try {
      const html = await fetchWithCredentials(url);
      const result = extractPanoptoMediaCandidatesFromHtml(html, url);
      state.candidates.push(...result.candidates);
      if (result.podcastDisabled) {
        state.podcastDisabled = true;
        state.disabledReason = result.disabledReason || state.disabledReason;
      }
      if (result.downloadEnabled) {
        state.downloadEnabled = true;
      }
      logger.debug(step, {
        status: 'ok',
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
      if (message === 'AUTH_REQUIRED') {
        state.authRequired = true;
      }
      logger.debug(step, {
        status: 'error',
        url,
        elapsedMs: Date.now() - started,
        meta: { error: message },
      });
    }
  }

  async function collectRuntimeCandidates({ tabId, state, logger }) {
    if (typeof runPanoptoRuntimeProbe !== 'function') {
      return;
    }
    const runtime = await runPanoptoRuntimeProbe(tabId, logger);
    state.candidates.push(...runtime.candidates);
    if (runtime.podcastDisabled) {
      state.podcastDisabled = true;
      state.disabledReason = runtime.disabledReason || state.disabledReason;
    }
    if (runtime.downloadEnabled) {
      state.downloadEnabled = true;
    }
  }

  function addPodcastCandidate({ resolvedTenant, resolvedDeliveryId, state }) {
    const podcastDownloadUrl = buildPanoptoPodcastDownloadUrl
      ? buildPanoptoPodcastDownloadUrl(resolvedTenant, resolvedDeliveryId)
      : null;
    if (podcastDownloadUrl) {
      state.candidates.push({
        url: podcastDownloadUrl,
        source: 'derived:podcast-download',
      });
    }
  }

  function buildNoCandidatesResponse({ state, primaryUrl, logger }) {
    if (state.podcastDisabled) {
      logger.warn('resolve', {
        status: 'podcast-disabled',
        url: primaryUrl,
        meta: { disabledReason: state.disabledReason },
      });
      return {
        ok: false,
        errorCode: 'PODCAST_DISABLED',
        message:
          'Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.',
      };
    }
    if (state.authRequired) {
      return {
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Authentication required. Please log in to Panopto and try again.',
      };
    }
    return {
      ok: false,
      errorCode: 'NOT_AVAILABLE',
      message: 'No downloadable media URL found. This video may not allow downloads.',
    };
  }

  async function resolveCandidateMediaUrl({ orderedCandidates, state, logger }) {
    if (typeof probePanoptoMediaUrl !== 'function') {
      return {
        ok: false,
        errorCode: 'NOT_AVAILABLE',
        message: 'Panopto network probe unavailable.',
      };
    }

    for (const candidate of orderedCandidates) {
      const probe = await probePanoptoMediaUrl(candidate.url, logger);
      if (probe.ok) {
        logger.info('resolve', {
          status: 'ok',
          url: candidate.url,
          finalUrl: probe.finalUrl,
        });
        return {
          ok: true,
          mediaUrl: probe.finalUrl || candidate.url,
          mime: probe.contentType || null,
          method: candidate.source || 'unknown',
        };
      }

      if (probe.errorCode === 'AUTH_REQUIRED') {
        logger.warn('resolve', {
          status: 'auth-required',
          url: candidate.url,
        });
        return {
          ok: false,
          errorCode: 'AUTH_REQUIRED',
          message:
            'Authentication required to access this Panopto download. Please log in and try again.',
        };
      }

      if (probe.status === 403 && state.podcastDisabled) {
        logger.warn('resolve', {
          status: 'podcast-disabled',
          url: candidate.url,
          meta: { disabledReason: state.disabledReason },
        });
        return {
          ok: false,
          errorCode: 'PODCAST_DISABLED',
          message:
            'Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.',
        };
      }
    }

    if (state.podcastDisabled) {
      return {
        ok: false,
        errorCode: 'PODCAST_DISABLED',
        message:
          'Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.',
      };
    }

    return {
      ok: false,
      errorCode: 'NOT_ALLOWED',
      message:
        'Panopto denied access to the download URL. Downloads may be disabled for your account.',
    };
  }

  const PanoptoMediaResolver = {
    async resolve({ tenant, deliveryId, viewerUrl, embedUrl, tabId, jobId }) {
      if (
        typeof extractPanoptoInfo !== 'function' ||
        typeof buildPanoptoViewerUrl !== 'function' ||
        typeof buildPanoptoEmbedUrl !== 'function' ||
        typeof fetchWithCredentials !== 'function' ||
        typeof extractPanoptoMediaCandidatesFromHtml !== 'function' ||
        typeof dedupeAndSortPanoptoCandidates !== 'function' ||
        typeof createPanoptoResolverLogger !== 'function'
      ) {
        return {
          ok: false,
          errorCode: 'NOT_AVAILABLE',
          message: 'Panopto helpers are unavailable.',
        };
      }

      const resolvedJobId = jobId || `panopto-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const debugEnabled = isPanoptoResolverDebugEnabled ? isPanoptoResolverDebugEnabled() : false;
      const logger = createPanoptoResolverLogger(resolvedJobId, debugEnabled);

      const context = resolvePanoptoContext({ tenant, deliveryId, viewerUrl, embedUrl });
      if (!context.primaryUrl) {
        return {
          ok: false,
          errorCode: 'INVALID_VIDEO',
          message: 'Panopto viewer URL not available.',
        };
      }

      logger.info('start', { status: 'begin', url: context.primaryUrl });

      const state = {
        candidates: [],
        podcastDisabled: false,
        downloadEnabled: false,
        disabledReason: null,
        authRequired: false,
      };

      if (context.resolvedViewerUrl) {
        await collectHtmlCandidates({
          url: context.resolvedViewerUrl,
          step: 'viewer-html',
          state,
          logger,
        });
      }
      if (context.resolvedEmbedUrl && context.resolvedEmbedUrl !== context.resolvedViewerUrl) {
        await collectHtmlCandidates({
          url: context.resolvedEmbedUrl,
          step: 'embed-html',
          state,
          logger,
        });
      }

      if (state.candidates.length === 0) {
        await collectRuntimeCandidates({ tabId, state, logger });
      }

      if (context.resolvedTenant && context.resolvedDeliveryId) {
        addPodcastCandidate({
          resolvedTenant: context.resolvedTenant,
          resolvedDeliveryId: context.resolvedDeliveryId,
          state,
        });
      }

      const orderedCandidates = dedupeAndSortPanoptoCandidates(state.candidates);
      if (debugEnabled && truncateUrl) {
        logger.debug('candidates', {
          status: 'list',
          meta: {
            count: orderedCandidates.length,
            urls: orderedCandidates.map((candidate) => ({
              url: truncateUrl(candidate.url),
              source: candidate.source,
            })),
          },
        });
      }

      if (orderedCandidates.length === 0) {
        return buildNoCandidatesResponse({ state, primaryUrl: context.primaryUrl, logger });
      }

      return resolveCandidateMediaUrl({ orderedCandidates, state, logger });
    },
  };

  if (typeof self !== 'undefined') {
    self.LockInPanoptoResolver = {
      PanoptoMediaResolver,
    };
  }
})();
