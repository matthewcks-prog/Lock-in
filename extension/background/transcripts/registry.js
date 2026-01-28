(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const transcripts = registry.transcripts || (registry.transcripts = {});

  function createTranscriptRegistry({ transcriptProviders, log }) {
    function getRegistry() {
      if (!transcriptProviders || typeof transcriptProviders.getProviderRegistry !== 'function') {
        return null;
      }
      return transcriptProviders.getProviderRegistry();
    }

    function resolveRegister(registryInstance) {
      if (!registryInstance) return null;
      if (typeof transcriptProviders?.registerProvider === 'function') {
        return (provider) => transcriptProviders.registerProvider(provider);
      }
      if (typeof registryInstance.register === 'function') {
        return (provider) => registryInstance.register(provider);
      }
      return null;
    }

    function ensureProvidersRegistered() {
      const registryInstance = getRegistry();
      if (!registryInstance) return;

      const register = resolveRegister(registryInstance);
      if (!register) return;

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

    function getProviderForVideo(video) {
      const registryInstance = getRegistry();
      if (!registryInstance || typeof registryInstance.getAll !== 'function') {
        return null;
      }
      const providers = registryInstance.getAll();
      return providers.find((provider) => provider.provider === video.provider) || null;
    }

    return {
      ensureProvidersRegistered,
      getProviderForVideo,
    };
  }

  transcripts.registry = {
    createTranscriptRegistry,
  };
})();
