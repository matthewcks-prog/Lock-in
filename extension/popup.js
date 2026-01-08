/**
 * Lock-in Popup Script
 * Handles settings management including mode preferences, difficulty, and language
 */

// DOM elements
const highlightingToggle = document.getElementById('highlighting-toggle');
const difficultyRadios = document.getElementsByName('difficulty');
const modePrefRadios = document.getElementsByName('modePreference');
const defaultModeControl = document.getElementById('default-mode-control');
const statusMessage = document.getElementById('status-message');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const loggedOutView = document.getElementById('auth-view-logged-out');
const loggedInView = document.getElementById('auth-view-logged-in');
const authUserEmail = document.getElementById('auth-user-email');
const logoutButton = document.getElementById('logout-button');
const authTabs = document.querySelectorAll('.auth-tab');
const authSubmitButton = document.getElementById('auth-submit-button');
const authModeHint = document.getElementById('auth-mode-hint');
const SUPABASE_CONFIG = window.LOCKIN_CONFIG || {};

let currentAuthMode = 'login';

/**
 * Load saved settings from chrome.storage.sync when popup opens
 */
function loadSettings() {
  chrome.storage.sync.get(
    [
      'highlightingEnabled',
      'preferredLanguage',
      'difficultyLevel',
      'defaultMode',
      'modePreference',
      'lastUsedMode',
    ],
    (data) => {
      // Set highlighting toggle (default to true)
      if (highlightingToggle) {
        highlightingToggle.checked = data.highlightingEnabled !== false;
      }

      // Set difficulty level
      const difficulty = data.difficultyLevel || 'highschool';
      difficultyRadios.forEach((radio) => {
        if (radio.value === difficulty) {
          radio.checked = true;
        }
      });

      // Set mode preference (fixed or lastUsed)
      const modePref = data.modePreference || 'fixed';
      modePrefRadios.forEach((radio) => {
        if (radio.value === modePref) {
          radio.checked = true;
        }
      });

      // Set default mode (explain)
      const defaultMode = data.defaultMode || 'explain';
      setActiveMode(defaultMode);

      // Toggle segmented control enabled state based on mode preference
      toggleModeControlState(modePref === 'fixed');
    },
  );
}

/**
 * Set the active mode button in the segmented control
 */
function setActiveMode(mode) {
  const buttons = defaultModeControl.querySelectorAll('.segment-btn');
  buttons.forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Toggle whether the mode control is enabled/disabled
 */
function toggleModeControlState(enabled) {
  const buttons = defaultModeControl.querySelectorAll('.segment-btn');
  buttons.forEach((btn) => {
    btn.style.opacity = enabled ? '1' : '0.5';
    btn.style.pointerEvents = enabled ? 'auto' : 'none';
  });
}

/**
 * Save settings to chrome.storage.sync
 * Automatically saves whenever any setting changes
 */
function saveSettings() {
  const highlightingEnabled = highlightingToggle ? highlightingToggle.checked : true;

  let difficultyLevel = 'highschool';
  difficultyRadios.forEach((radio) => {
    if (radio.checked) {
      difficultyLevel = radio.value;
    }
  });

  let modePreference = 'fixed';
  modePrefRadios.forEach((radio) => {
    if (radio.checked) {
      modePreference = radio.value;
    }
  });

  // Get active default mode
  const activeBtn = defaultModeControl.querySelector('.segment-btn.active');
  const defaultMode = activeBtn ? activeBtn.dataset.mode : 'explain';

  chrome.storage.sync.set(
    {
      highlightingEnabled,
      difficultyLevel,
      modePreference,
      defaultMode,
    },
    () => {
      showStatus('Saved &check;', 'success');
    },
  );
}

/**
 * Show status message
 */
function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  // Auto-hide after 2 seconds
  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 2000);
}

// Event listeners

// Highlighting toggle
if (highlightingToggle) {
  highlightingToggle.addEventListener('change', saveSettings);
}

// Mode preference radio change
modePrefRadios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const isFixed = e.target.value === 'fixed';
    toggleModeControlState(isFixed);
    saveSettings();
  });
});

// Default mode segmented control clicks
defaultModeControl.addEventListener('click', (e) => {
  const btn = e.target.closest('.segment-btn');
  if (!btn) return;

  setActiveMode(btn.dataset.mode);
  saveSettings();
});

// Difficulty changes
difficultyRadios.forEach((radio) => {
  radio.addEventListener('change', saveSettings);
});

function isSupabaseConfigured() {
  if (!SUPABASE_CONFIG) {
    return false;
  }

  const url = SUPABASE_CONFIG.SUPABASE_URL || '';
  const anonKey = SUPABASE_CONFIG.SUPABASE_ANON_KEY || '';
  const urlLooksValid = url && !url.includes('YOUR-PROJECT');
  const keyLooksValid = anonKey && anonKey !== 'public-anon-key';
  return Boolean(urlLooksValid && keyLooksValid);
}

function setAuthMessage(message, type = 'error') {
  if (!authMessage) return;
  authMessage.textContent = message || '';
  authMessage.className = `auth-message ${type}`.trim();
}

function getFriendlyAuthError(error) {
  const code = error?.code;
  if (code === 'INVALID_LOGIN') {
    return 'Incorrect email or password. Please try again.';
  }
  if (code === 'EMAIL_NOT_CONFIRMED') {
    return 'Confirm your email address before signing in.';
  }
  if (code === 'EMAIL_CONFIRMATION_REQUIRED') {
    return 'We sent you a confirmation email. Please verify it, then sign in.';
  }
  if (code === 'INVALID_EMAIL') {
    return 'Enter a valid email address.';
  }
  if (code === 'USER_ALREADY_REGISTERED') {
    return 'An account already exists for this email. Try logging in instead.';
  }
  return error?.message || "We couldn't sign you in. Please try again.";
}

function updateAuthModeUI() {
  authTabs.forEach((tab) => {
    const mode = tab.getAttribute('data-mode');
    if (mode === currentAuthMode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (!authSubmitButton || !authModeHint) {
    return;
  }

  if (currentAuthMode === 'login') {
    authSubmitButton.textContent = 'Log in';
    authModeHint.textContent = 'Use your Lock-in account email and password.';
  } else {
    authSubmitButton.textContent = 'Create account';
    authModeHint.textContent = 'Choose a password you will remember.';
  }
}

async function refreshAuthView() {
  if (!window.LockInAuth || !loggedInView || !loggedOutView) {
    return;
  }

  const session = await window.LockInAuth.getSession();
  if (session?.accessToken) {
    loggedOutView.classList.add('hidden');
    loggedInView.classList.remove('hidden');
    const email = session.user?.email || 'Signed in';
    if (authUserEmail) {
      authUserEmail.textContent = email;
    }
    setAuthMessage('Signed in', 'success');
  } else {
    loggedOutView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
    setAuthMessage('Sign in to use Lock-in and keep your chat history.', '');
  }
}

function disableAuthInputs() {
  if (authForm) {
    Array.from(authForm.elements).forEach((el) => {
      el.disabled = true;
    });
  }
  if (logoutButton) {
    logoutButton.disabled = true;
  }
}

function enableAuthInputs() {
  if (authForm) {
    Array.from(authForm.elements).forEach((el) => {
      el.disabled = false;
    });
  }
  if (logoutButton) {
    logoutButton.disabled = false;
  }
}

function initAuthSection() {
  if (!authForm || !window.LockInAuth) {
    return;
  }

  if (!isSupabaseConfigured()) {
    disableAuthInputs();
    setAuthMessage('Configure SUPABASE_URL and SUPABASE_ANON_KEY in config.js', 'error');
    return;
  }

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      currentAuthMode = tab.getAttribute('data-mode') || 'login';
      updateAuthModeUI();
    });
  });
  updateAuthModeUI();

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = authEmailInput?.value?.trim();
    const password = authPasswordInput?.value || '';

    if (!email || !password) {
      setAuthMessage('Email and password are required', 'error');
      return;
    }

    disableAuthInputs();
    setAuthMessage(
      currentAuthMode === 'login' ? 'Signing you in...' : 'Creating account...',
      'success',
    );
    try {
      if (currentAuthMode === 'login') {
        await window.LockInAuth.signInWithEmail(email, password);
      } else {
        await window.LockInAuth.signUpWithEmail(email, password);
      }
      if (authPasswordInput) {
        authPasswordInput.value = '';
      }
      setAuthMessage("You're signed in. Highlight text to start!", 'success');
      refreshAuthView();
    } catch (error) {
      console.error('Lock-in auth sign-in error:', error);
      setAuthMessage(getFriendlyAuthError(error), 'error');
    } finally {
      enableAuthInputs();
    }
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      disableAuthInputs();
      try {
        await window.LockInAuth.signOut();
        setAuthMessage('Signed out', 'success');
        refreshAuthView();
      } catch (error) {
        console.error('Lock-in auth sign-out error:', error);
        setAuthMessage('Failed to sign out', 'error');
      } finally {
        enableAuthInputs();
      }
    });
  }

  window.LockInAuth.onSessionChanged(() => {
    refreshAuthView();
  });

  refreshAuthView();
}

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initAuthSection();
});
