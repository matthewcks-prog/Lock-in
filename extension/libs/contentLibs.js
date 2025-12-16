var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
(function(exports) {
  "use strict";
  function isDebugEnabled() {
    if (typeof window === "undefined") return false;
    const config = window.LOCKIN_CONFIG;
    return (config == null ? void 0 : config.DEBUG) === true || (config == null ? void 0 : config.DEBUG) === "true";
  }
  function createLogger() {
    const PREFIX = "[Lock-in]";
    return {
      debug(...args) {
        if (isDebugEnabled()) {
          console.debug(PREFIX, ...args);
        }
      },
      info(...args) {
        console.info(PREFIX, ...args);
      },
      warn(...args) {
        console.warn(PREFIX, ...args);
      },
      error(...args) {
        console.error(PREFIX, ...args);
      }
    };
  }
  const logger = createLogger();
  if (typeof window !== "undefined") {
    window.LockInLogger = logger;
  }
  function createMessaging() {
    return {
      sendToBackground(message) {
        return new Promise((resolve, reject) => {
          try {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      onMessage(callback) {
        const listener = (message, sender, sendResponse) => {
          try {
            const result = callback(message, sender);
            if (result instanceof Promise) {
              result.then(sendResponse).catch((err) => {
                console.error("[Lock-in] Message handler error:", err);
                sendResponse({ error: err.message });
              });
              return true;
            }
            if (result !== void 0) {
              sendResponse(result);
            }
          } catch (err) {
            console.error("[Lock-in] Message handler error:", err);
            sendResponse({ error: err instanceof Error ? err.message : "Unknown error" });
          }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => {
          chrome.runtime.onMessage.removeListener(listener);
        };
      },
      sendToTab(tabId, message) {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      }
    };
  }
  const messaging = createMessaging();
  if (typeof window !== "undefined") {
    window.LockInMessaging = messaging;
  }
  const STORAGE_KEYS = {
    SIDEBAR_IS_OPEN: "lockin_sidebar_isOpen",
    SIDEBAR_ACTIVE_TAB: "lockin_sidebar_activeTab",
    CURRENT_CHAT_ID: "lockinCurrentChatId",
    ACTIVE_MODE: "lockinActiveMode",
    MODE_PREFERENCE: "modePreference",
    DEFAULT_MODE: "defaultMode",
    LAST_USED_MODE: "lastUsedMode",
    HIGHLIGHTING_ENABLED: "highlightingEnabled",
    SELECTED_NOTE_ID: "lockin_selectedNoteId"
  };
  function createStorage() {
    return {
      STORAGE_KEYS,
      get(keys) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.sync.get(keys, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      set(data) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.sync.set(data, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      remove(keys) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.sync.remove(keys, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      getLocal(keys) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.local.get(keys, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      setLocal(key, value) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.local.set({ [key]: value }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      removeLocal(keys) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.local.remove(keys, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          } catch (err) {
            reject(err);
          }
        });
      },
      onChanged(callback) {
        const listener = (changes, areaName) => {
          const normalizedChanges = {};
          for (const key in changes) {
            normalizedChanges[key] = {
              oldValue: changes[key].oldValue,
              newValue: changes[key].newValue
            };
          }
          callback(normalizedChanges, areaName);
        };
        chrome.storage.onChanged.addListener(listener);
        return () => {
          chrome.storage.onChanged.removeListener(listener);
        };
      }
    };
  }
  const storage = createStorage();
  if (typeof window !== "undefined") {
    window.LockInStorage = storage;
  }
  class GenericAdapter {
    canHandle(_url) {
      return true;
    }
    getCourseCode(_dom) {
      return null;
    }
    getWeek(_dom) {
      return null;
    }
    getTopic(dom) {
      var _a, _b;
      const heading = (_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      return heading || null;
    }
    getCourseContext(_dom, url) {
      return {
        courseCode: null,
        sourceUrl: url
      };
    }
    getPageContext(dom, url) {
      var _a, _b;
      const heading = ((_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || dom.title;
      return {
        url,
        title: dom.title,
        heading,
        courseContext: this.getCourseContext(dom, url)
      };
    }
  }
  function extractCourseCodeFromText(text) {
    if (!text || typeof text !== "string") return null;
    const match = text.match(/\b([A-Z]{3}\d{4})\b/i);
    return match ? match[1].toUpperCase() : null;
  }
  class MoodleAdapter {
    constructor() {
    }
    canHandle(url) {
      return url.includes("learning.monash.edu");
    }
    /**
     * Get course code from page DOM
     */
    getCourseCode(dom) {
      var _a;
      const candidateTexts = [];
      const metaSelectors = [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]'
      ];
      metaSelectors.forEach((selector) => {
        var _a2;
        const content = (_a2 = dom.querySelector(selector)) == null ? void 0 : _a2.getAttribute("content");
        if (content) candidateTexts.push(content);
      });
      const headingSelectors = [
        "h1",
        "h2",
        ".page-header-headings",
        ".page-header-headings h1",
        ".course-title",
        ".breadcrumb",
        "[data-region='course-header']"
      ];
      headingSelectors.forEach((selector) => {
        dom.querySelectorAll(selector).forEach((el) => {
          var _a2;
          const text = (_a2 = el.textContent) == null ? void 0 : _a2.trim();
          if (text) candidateTexts.push(text);
        });
      });
      const bodyText = ((_a = dom.body) == null ? void 0 : _a.innerText) || "";
      if (bodyText) {
        candidateTexts.push(bodyText.substring(0, 8e3));
      }
      for (const text of candidateTexts) {
        const code = extractCourseCodeFromText(text);
        if (code) {
          const courseId2 = this.getCourseId(dom);
          if (courseId2) {
            this.persistCourseMapping(courseId2, code);
          }
          return code;
        }
      }
      const courseId = this.getCourseId(dom);
      if (courseId) {
        return this.getStoredCourseMapping(courseId);
      }
      return null;
    }
    /**
     * Extract week number from Moodle page
     * 
     * Looks for the "Week X" label that appears above topic headings on Moodle learning pages.
     * Only returns a week if found in a specific, reliable location (not in general content).
     */
    getWeek(dom) {
      var _a, _b;
      const weekPattern = /^\s*Week\s+(\d{1,2})\s*$/i;
      const preciseSelectors = [
        // Moodle section info region
        '[data-region="section-info"] .text-muted',
        '[data-region="section-info"]',
        // Activity header area
        ".activity-header .text-muted",
        ".page-header-headings .text-muted",
        // Breadcrumb might have it
        ".breadcrumb-item.active"
      ];
      for (const selector of preciseSelectors) {
        const elements = dom.querySelectorAll(selector);
        for (const el of elements) {
          const text = ((_a = el.textContent) == null ? void 0 : _a.trim()) || "";
          const match = text.match(weekPattern);
          if (match) {
            const weekNum = parseInt(match[1], 10);
            if (weekNum > 0 && weekNum <= 52) {
              return weekNum;
            }
          }
        }
      }
      const headingSelectors = ["h2", "h3", "h4", "strong", ".section-title"];
      for (const selector of headingSelectors) {
        const elements = dom.querySelectorAll(selector);
        for (const el of elements) {
          const text = ((_b = el.textContent) == null ? void 0 : _b.trim()) || "";
          const match = text.match(weekPattern);
          if (match) {
            const weekNum = parseInt(match[1], 10);
            if (weekNum > 0 && weekNum <= 52) {
              return weekNum;
            }
          }
        }
      }
      const sectionContent = dom.querySelector(".course-content .section, #region-main .content");
      if (sectionContent) {
        const text = (sectionContent.textContent || "").substring(0, 300);
        const startMatch = text.match(/^\s*Week\s+(\d{1,2})\b/i);
        if (startMatch) {
          const weekNum = parseInt(startMatch[1], 10);
          if (weekNum > 0 && weekNum <= 52) {
            return weekNum;
          }
        }
      }
      return null;
    }
    /**
     * Extract topic/title from page
     */
    getTopic(dom) {
      var _a, _b;
      const heading = (_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      return heading || null;
    }
    /**
     * Get course ID from URL query params
     */
    getCourseId(dom) {
      const url = new URL(dom.location.href);
      return url.searchParams.get("id");
    }
    /**
     * Get stored course code mapping from localStorage
     */
    getStoredCourseMapping(courseId) {
      try {
        const raw = localStorage.getItem("lockin:monashCourseCodes");
        const mapping = raw ? JSON.parse(raw) : {};
        return mapping[courseId] || null;
      } catch (error) {
        console.warn("Failed to read cached Monash course codes", error);
        return null;
      }
    }
    /**
     * Persist course code mapping to localStorage
     */
    persistCourseMapping(courseId, courseCode) {
      if (!courseId || !courseCode) return;
      try {
        const existing = this.getStoredCourseMapping(courseId) ? JSON.parse(localStorage.getItem("lockin:monashCourseCodes") || "{}") : {};
        if (existing[courseId] === courseCode) return;
        const next = __spreadProps(__spreadValues({}, existing), { [courseId]: courseCode });
        localStorage.setItem("lockin:monashCourseCodes", JSON.stringify(next));
      } catch (error) {
        console.warn("Failed to persist Monash course code", error);
      }
    }
    /**
     * Get full course context
     */
    getCourseContext(dom, url) {
      const courseCode = this.getCourseCode(dom);
      const topic = this.getTopic(dom);
      const week = this.getWeek(dom);
      return {
        courseCode,
        courseName: courseCode || void 0,
        week: week || void 0,
        topic: topic || void 0,
        sourceUrl: url,
        sourceLabel: week ? `Week ${week}` : topic || courseCode || void 0
      };
    }
    /**
     * Get full page context
     */
    getPageContext(dom, url) {
      var _a, _b;
      const heading = ((_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || dom.title;
      const courseContext = this.getCourseContext(dom, url);
      return {
        url,
        title: dom.title,
        heading,
        courseContext
      };
    }
  }
  class EdstemAdapter {
    canHandle(url) {
      return url.includes("edstem.org");
    }
    getCourseCode(dom) {
      var _a, _b;
      const title = dom.title;
      const heading = (_b = (_a = dom.querySelector("h1")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      const candidates = [title, heading].filter(Boolean);
      for (const text of candidates) {
        const code = extractCourseCodeFromText(text || "");
        if (code) return code;
      }
      return null;
    }
    getWeek(_dom) {
      return null;
    }
    getTopic(dom) {
      var _a, _b;
      const heading = (_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim();
      return heading || null;
    }
    getCourseContext(dom, url) {
      const courseCode = this.getCourseCode(dom);
      const topic = this.getTopic(dom);
      return {
        courseCode,
        topic: topic || void 0,
        sourceUrl: url,
        sourceLabel: topic || courseCode || void 0
      };
    }
    getPageContext(dom, url) {
      var _a, _b;
      const heading = ((_b = (_a = dom.querySelector("h1, h2")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || dom.title;
      const courseContext = this.getCourseContext(dom, url);
      return {
        url,
        title: dom.title,
        heading,
        courseContext
      };
    }
  }
  const adapters = [
    new MoodleAdapter(),
    new EdstemAdapter(),
    new GenericAdapter()
    // Fallback - must be last
  ];
  function getAdapterForUrl(url) {
    for (const adapter of adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return new GenericAdapter();
  }
  const MESSAGE_TYPES = {
    GET_TAB_ID: "GET_TAB_ID",
    GET_SESSION: "GET_SESSION",
    SAVE_SESSION: "SAVE_SESSION",
    CLEAR_SESSION: "CLEAR_SESSION",
    GET_SETTINGS: "GET_SETTINGS",
    UPDATE_SETTINGS: "UPDATE_SETTINGS"
  };
  function inferCourseCode(dom, url) {
    var _a;
    const urlMatch = url.match(/\b([A-Z]{3}\d{4})\b/i);
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }
    const bodyText = ((_a = dom.body) == null ? void 0 : _a.innerText) || "";
    const codeMatch = bodyText.match(/\b([A-Z]{3}\d{4})\b/i);
    return codeMatch ? codeMatch[1].toUpperCase() : null;
  }
  function resolveAdapterContext(loggerInstance) {
    var _a, _b, _c;
    const log = {
      error: (_a = loggerInstance == null ? void 0 : loggerInstance.error) != null ? _a : console.error,
      warn: (_b = loggerInstance == null ? void 0 : loggerInstance.warn) != null ? _b : console.warn,
      debug: (_c = loggerInstance == null ? void 0 : loggerInstance.debug) != null ? _c : (() => {
      })
    };
    let adapter = new GenericAdapter();
    let pageContext = {
      url: window.location.href,
      title: document.title,
      heading: document.title,
      courseContext: { courseCode: null, sourceUrl: window.location.href }
    };
    try {
      adapter = getAdapterForUrl(window.location.href) || adapter;
      pageContext = adapter.getPageContext(document, window.location.href);
      const courseContext = pageContext.courseContext || {
        courseCode: null,
        sourceUrl: window.location.href
      };
      if (!courseContext.courseCode) {
        const inferred = inferCourseCode(document, window.location.href);
        if (inferred) {
          pageContext = __spreadProps(__spreadValues({}, pageContext), {
            courseContext: __spreadProps(__spreadValues({}, courseContext), {
              courseCode: inferred
            })
          });
        }
      }
    } catch (error) {
      log.error("Failed to get page context:", error);
    }
    return { adapter, pageContext };
  }
  function createStorageApi(log) {
    return __spreadProps(__spreadValues({}, storage), {
      getLocal(keys) {
        return __async(this, null, function* () {
          try {
            return yield storage.getLocal(keys);
          } catch (error) {
            log.warn("Storage.getLocal failed:", error);
            throw error;
          }
        });
      },
      setLocal(key, value) {
        return __async(this, null, function* () {
          try {
            yield storage.setLocal(key, value);
          } catch (error) {
            log.warn("Storage.setLocal failed:", error);
            throw error;
          }
        });
      },
      removeLocal(keys) {
        return __async(this, null, function* () {
          try {
            yield storage.removeLocal(keys);
          } catch (error) {
            log.warn("Storage.removeLocal failed:", error);
            throw error;
          }
        });
      },
      onChanged(callback) {
        return storage.onChanged(callback);
      }
    });
  }
  function createMessagingApi(log) {
    return __spreadProps(__spreadValues({}, messaging), {
      types: MESSAGE_TYPES,
      send(type, payload) {
        return __async(this, null, function* () {
          try {
            return yield messaging.sendToBackground({ type, payload });
          } catch (error) {
            log.error("[Lock-in] Messaging send failed:", error);
            throw error;
          }
        });
      }
    });
  }
  function createSessionApi(log, runtimeMessaging, runtimeStorage) {
    let cachedTabId = null;
    function getTabId() {
      return __async(this, null, function* () {
        var _a, _b, _c;
        try {
          const response = yield runtimeMessaging.send(runtimeMessaging.types.GET_TAB_ID);
          const tabId = (_c = (_b = (_a = response == null ? void 0 : response.data) == null ? void 0 : _a.tabId) != null ? _b : response == null ? void 0 : response.tabId) != null ? _c : null;
          if (typeof tabId === "number") {
            cachedTabId = tabId;
            return tabId;
          }
          return cachedTabId;
        } catch (error) {
          log.error("[Lock-in] Failed to get tab ID:", error);
          return cachedTabId;
        }
      });
    }
    function getSession() {
      return __async(this, null, function* () {
        var _a, _b, _c;
        try {
          const response = yield runtimeMessaging.send(runtimeMessaging.types.GET_SESSION);
          return (_c = (_b = (_a = response == null ? void 0 : response.data) == null ? void 0 : _a.session) != null ? _b : response == null ? void 0 : response.session) != null ? _c : null;
        } catch (error) {
          log.error("[Lock-in] Failed to get session:", error);
          return null;
        }
      });
    }
    function clearSession() {
      return __async(this, null, function* () {
        try {
          yield runtimeMessaging.send(runtimeMessaging.types.CLEAR_SESSION);
        } catch (error) {
          log.error("[Lock-in] Failed to clear session:", error);
        }
      });
    }
    function loadChatId() {
      return __async(this, null, function* () {
        try {
          const data = yield runtimeStorage.getLocal(STORAGE_KEYS.CURRENT_CHAT_ID);
          const chatId = data[STORAGE_KEYS.CURRENT_CHAT_ID];
          return typeof chatId === "string" ? chatId : null;
        } catch (error) {
          log.warn("Failed to load chat ID:", error);
          return null;
        }
      });
    }
    return {
      getTabId,
      getSession,
      clearSession,
      loadChatId
    };
  }
  function createContentRuntime() {
    const runtimeLogger = logger;
    const runtimeStorage = createStorageApi(runtimeLogger);
    const runtimeMessaging = createMessagingApi(runtimeLogger);
    const runtimeSession = createSessionApi(runtimeLogger, runtimeMessaging, runtimeStorage);
    const runtime = {
      __version: "1.0",
      logger: runtimeLogger,
      storage: runtimeStorage,
      messaging: runtimeMessaging,
      session: runtimeSession,
      resolveAdapterContext
    };
    return runtime;
  }
  if (typeof window !== "undefined") {
    const runtime = createContentRuntime();
    window.LockInContent = runtime;
    window.LockInContent.__version = runtime.__version;
  }
  exports.createContentRuntime = createContentRuntime;
})(this.LockInContentLibs = this.LockInContentLibs || {});
//# sourceMappingURL=contentLibs.js.map
