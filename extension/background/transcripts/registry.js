(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function getRegistry(transcriptProviders) {
    if (!transcriptProviders || typeof transcriptProviders.getProviderRegistry !== 'function') {
      return null;
    }
    return transcriptProviders.getProviderRegistry();
  }

  function resolveRegister(transcriptProviders, registryInstance) {
    if (!registryInstance) return null;
    if (typeof transcriptProviders?.registerProvider === 'function') {
      return (provider) => transcriptProviders.registerProvider(provider);
    }
    if (typeof registryInstance.register === 'function') {
      return (provider) => registryInstance.register(provider);
    }
    return null;
  }

  function registerMissingProviders({ transcriptProviders, registryInstance, register }) {
    const existingProviders =
      typeof registryInstance.getAll === 'function' ? registryInstance.getAll() : [];
    const existingNames = new Set(
      existingProviders.map((provider) => provider?.provider).filter(Boolean),
    );
    const providerClasses = [
      transcriptProviders?.PanoptoProvider,
      transcriptProviders?.Echo360Provider,
      transcriptProviders?.Html5Provider,
    ];

    providerClasses.forEach((Provider) => {
      if (typeof Provider !== 'function') return;
      const instance = new Provider();
      if (instance?.provider && existingNames.has(instance.provider)) {
        return;
      }
      register(instance);
      if (instance?.provider) {
        existingNames.add(instance.provider);
      }
    });
  }

  function ensureProvidersRegistered(transcriptProviders) {
    const registryInstance = getRegistry(transcriptProviders);
    if (!registryInstance) return;
    const register = resolveRegister(transcriptProviders, registryInstance);
    if (!register) return;
    registerMissingProviders({ transcriptProviders, registryInstance, register });
  }

  function getProviderForVideo(transcriptProviders, video) {
    const registryInstance = getRegistry(transcriptProviders);
    if (!registryInstance || typeof registryInstance.getAll !== 'function') {
      return null;
    }
    const providers = registryInstance.getAll();
    return providers.find((provider) => provider.provider === video.provider) || null;
  }

  function createTranscriptRegistry({ transcriptProviders, log }) {
    void log;

    return {
      ensureProvidersRegistered: () => ensureProvidersRegistered(transcriptProviders),
      getProviderForVideo: (video) => getProviderForVideo(transcriptProviders, video),
    };
  }

  transcripts.registry = {
    createTranscriptRegistry,
  };
})();
