const DEFAULT_MONASH_NOTICE_DISMISSED_KEY = 'dismissed.monashNotice';
const DEFAULT_REPO_URL = 'https://github.com/matthewcks-prog/Lock-in';
const DEFAULT_POLICY_LINKS = {
  TERMS_OF_SERVICE: `${DEFAULT_REPO_URL}/blob/main/TERMS.md`,
  PRIVACY_POLICY: `${DEFAULT_REPO_URL}/blob/main/PRIVACY.md`,
};
const MOODLE_PATH_PATTERNS = [/^\/(my|course|mod|calendar|grade|user|login)(\/|$)/i, /^\/local\//i];

function getRuntimeConfig() {
  return window.LOCKIN_CONFIG || {};
}

function getMonashNoticeDismissedKey() {
  const key = getRuntimeConfig().CLIENT_STORAGE?.KEYS?.MONASH_NOTICE_DISMISSED;
  return typeof key === 'string' && key.length > 0 ? key : DEFAULT_MONASH_NOTICE_DISMISSED_KEY;
}

function setAnchorHref(anchor, url) {
  if (!anchor || typeof url !== 'string' || url.length === 0) {
    return;
  }
  anchor.href = url;
}

function bindExternalLinks() {
  const externalLinks = getRuntimeConfig().EXTERNAL_LINKS || {};
  document.querySelectorAll('[data-external-link]').forEach((anchor) => {
    const key = anchor.getAttribute('data-external-link');
    if (!key) return;
    setAnchorHref(anchor, externalLinks[key]);
  });
}

function bindPolicyLinks() {
  const config = getRuntimeConfig();
  const policyLinks = config.POLICY_LINKS || DEFAULT_POLICY_LINKS;
  const repoUrl =
    typeof config.REPO_URL === 'string' && config.REPO_URL.length > 0
      ? config.REPO_URL
      : DEFAULT_REPO_URL;

  setAnchorHref(document.getElementById('signup-terms-link'), policyLinks.TERMS_OF_SERVICE);
  setAnchorHref(document.getElementById('signup-privacy-link'), policyLinks.PRIVACY_POLICY);
  setAnchorHref(document.getElementById('about-terms-link'), policyLinks.TERMS_OF_SERVICE);
  setAnchorHref(document.getElementById('about-privacy-link'), policyLinks.PRIVACY_POLICY);
  setAnchorHref(document.getElementById('footer-terms-link'), policyLinks.TERMS_OF_SERVICE);
  setAnchorHref(document.getElementById('footer-privacy-link'), policyLinks.PRIVACY_POLICY);
  setAnchorHref(document.getElementById('about-repo-link'), repoUrl);
}

function setManifestVersion() {
  let version = 'unknown';
  try {
    version = chrome.runtime.getManifest().version || version;
  } catch {
    // Ignore runtime errors in tests/non-extension contexts.
  }

  const aboutVersion = document.getElementById('about-version');
  if (aboutVersion) {
    aboutVersion.textContent = `Version: ${version}`;
  }

  const footerVersion = document.getElementById('footer-version');
  if (footerVersion) {
    footerVersion.textContent = `v${version}`;
  }
}

function normalizeHostname(hostname) {
  return (hostname || '').trim().toLowerCase().replace(/\.$/, '');
}

function isKnownMoodleHost(hostname) {
  const hosts = getRuntimeConfig().MONASH_MOODLE_HOSTS || [];
  const normalized = normalizeHostname(hostname);
  return hosts.includes(normalized);
}

function isMonashEduHost(hostname) {
  return normalizeHostname(hostname).endsWith('.monash.edu');
}

function hasMoodlePath(pathname) {
  return MOODLE_PATH_PATTERNS.some((pattern) => pattern.test(pathname || ''));
}

function isMonashMoodleUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = normalizeHostname(parsed.hostname);
    return (
      isKnownMoodleHost(hostname) || (isMonashEduHost(hostname) && hasMoodlePath(parsed.pathname))
    );
  } catch {
    return false;
  }
}

function hideMonashBanner() {
  const banner = document.getElementById('monash-notice-banner');
  banner?.classList.add('hidden');
}

function showMonashBanner() {
  const banner = document.getElementById('monash-notice-banner');
  banner?.classList.remove('hidden');
}

function openMonashModal() {
  document.getElementById('monash-links-modal')?.classList.remove('hidden');
}

function closeMonashModal() {
  document.getElementById('monash-links-modal')?.classList.add('hidden');
}

function initMonashModal() {
  document.getElementById('monash-modal-close')?.addEventListener('click', closeMonashModal);
  document.getElementById('monash-links-modal')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.getAttribute('data-close-modal') === 'true') {
      closeMonashModal();
    }
  });
}

async function initMonashNoticeBanner() {
  const noticeViewButton = document.getElementById('monash-notice-view');
  const noticeDismissButton = document.getElementById('monash-notice-dismiss');
  if (!noticeViewButton || !noticeDismissButton) {
    return;
  }
  const monashNoticeDismissedKey = getMonashNoticeDismissedKey();

  noticeViewButton.addEventListener('click', openMonashModal);
  noticeDismissButton.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({ [monashNoticeDismissedKey]: true });
    } catch {
      // Ignore storage write failures and still hide banner.
    }
    hideMonashBanner();
  });

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeUrl = activeTab?.url || '';
    if (!isMonashMoodleUrl(activeUrl)) {
      hideMonashBanner();
      return;
    }

    const storageResult = await chrome.storage.local.get([monashNoticeDismissedKey]);
    if (storageResult[monashNoticeDismissedKey] === true) {
      hideMonashBanner();
      return;
    }

    showMonashBanner();
  } catch {
    hideMonashBanner();
  }
}

function setAuthMode(mode) {
  const signupConsentRow = document.getElementById('signup-consent-row');
  const signupConsentCheckbox = document.getElementById('signup-consent-checkbox');
  const isSignupMode = mode === 'signup';
  if (signupConsentRow) {
    signupConsentRow.classList.toggle('hidden', !isSignupMode);
  }
  if (signupConsentCheckbox instanceof HTMLInputElement) {
    signupConsentCheckbox.required = isSignupMode;
  }
}

function isSignupConsentChecked() {
  const signupConsentCheckbox = document.getElementById('signup-consent-checkbox');
  return signupConsentCheckbox instanceof HTMLInputElement && signupConsentCheckbox.checked;
}

function onSignupConsentChanged(callback) {
  const signupConsentCheckbox = document.getElementById('signup-consent-checkbox');
  if (!(signupConsentCheckbox instanceof HTMLInputElement)) {
    return;
  }
  signupConsentCheckbox.addEventListener('change', () => callback(isSignupConsentChecked()));
}

function initComplianceSection(options = {}) {
  bindExternalLinks();
  bindPolicyLinks();
  setManifestVersion();
  initMonashModal();
  void initMonashNoticeBanner();
  if (typeof options.onSignupConsentChanged === 'function') {
    onSignupConsentChanged(options.onSignupConsentChanged);
  }
}

window.LockInPopupCompliance = {
  initComplianceSection,
  setAuthMode,
  isSignupConsentChecked,
};
