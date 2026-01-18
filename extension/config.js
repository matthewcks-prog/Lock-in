(function() {
  "use strict";
  (function() {
    const root = typeof window !== "undefined" ? window : self;
    if (root.LOCKIN_CONFIG) {
      return;
    }
    const appEnv = "development".toLowerCase();
    const isProduction = appEnv === "production";
    const configByEnv = {
      development: {
        url: "",
        anonKey: "",
        environment: "development",
        backendUrl: "http://localhost:3000"
      },
      production: {
        url: "",
        anonKey: "",
        environment: "production",
        backendUrl: "https://lock-in-backend.australiaeast.azurecontainerapps.io"
      }
    };
    const supabaseConfig = isProduction ? configByEnv.production : configByEnv.development;
    const missingEnvVars = [];
    {
      missingEnvVars.push(isProduction ? "VITE_SUPABASE_URL_PROD" : "VITE_SUPABASE_URL_DEV");
    }
    {
      missingEnvVars.push(
        isProduction ? "VITE_SUPABASE_ANON_KEY_PROD" : "VITE_SUPABASE_ANON_KEY_DEV"
      );
    }
    root.LOCKIN_CONFIG = {
      APP_ENV: appEnv,
      IS_PRODUCTION: isProduction,
      BACKEND_URL: supabaseConfig.backendUrl,
      SUPABASE_URL: supabaseConfig.url,
      SUPABASE_ANON_KEY: supabaseConfig.anonKey,
      SUPABASE_ENVIRONMENT: supabaseConfig.environment,
      SESSION_STORAGE_KEY: "lockinSupabaseSession",
      TOKEN_EXPIRY_BUFFER_MS: 6e4,
      DEBUG_PANOPTO_RESOLVER: !isProduction,
      DEBUG: void 0,
      SENTRY_DSN: void 0
    };
    if (missingEnvVars.length > 0 && typeof console !== "undefined") {
      console.warn("[Lock-in] Missing extension env vars:", missingEnvVars);
    }
    if (!isProduction && typeof console !== "undefined") {
      console.log("[Lock-in] Extension config loaded:", {
        environment: appEnv,
        supabase: supabaseConfig.environment,
        backendUrl: root.LOCKIN_CONFIG.BACKEND_URL
      });
    }
  })();
})();
//# sourceMappingURL=config.js.map
