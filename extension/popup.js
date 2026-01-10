/**
 * Lock-in Popup Script
 * Handles settings management including authentication, privacy, and help/support
 */

// ============================================================================
// Sentry Initialization (must be first)
// ============================================================================

// Initialize Sentry immediately for error tracking (popup surface)
// LockInSentry is loaded via dist/libs/sentry.js before this script
if (typeof window !== 'undefined' && window.LockInSentry) {
  window.LockInSentry.initSentry('popup');
}

// DOM elements
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
const passwordToggle = document.getElementById('password-toggle');
const passwordWrapper = document.getElementById('password-wrapper');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const accountStatus = document.getElementById('account-status');
const accordionHeaders = document.querySelectorAll('.accordion-header');
const SUPABASE_CONFIG = window.LOCKIN_CONFIG || {};

let currentAuthMode = 'login';

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

  const btnText = authSubmitButton.querySelector('.btn-text');
  

  // Show/hide forgot password link
  if (forgotPasswordLink) {
    forgotPasswordLink.style.display = currentAuthMode === 'login' ? 'inline' : 'none';
  }

  if (currentAuthMode === 'login') {
    if (btnText) btnText.textContent = 'Log in';
    authModeHint.textContent = 'Use your Lock-in account email and password.';
  } else if (currentAuthMode === 'signup') {
    if (btnText) btnText.textContent = 'Create account';
    authModeHint.textContent = 'Choose a password you will remember.';
  }
}

function setAuthLoading(isLoading) {
  if (!authSubmitButton) return;
  
  const btnText = authSubmitButton.querySelector('.btn-text');
  const btnSpinner = authSubmitButton.querySelector('.btn-spinner');
  
  if (isLoading) {
    authSubmitButton.disabled = true;
    authSubmitButton.classList.add('loading');
    if (btnText) btnText.style.opacity = '0';
    if (btnSpinner) btnSpinner.style.display = 'flex';
  } else {
    authSubmitButton.disabled = false;
    authSubmitButton.classList.remove('loading');
    if (btnText) btnText.style.opacity = '1';
    if (btnSpinner) btnSpinner.style.display = 'none';
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
    if (accountStatus) {
      accountStatus.textContent = email;
      accountStatus.classList.add('signed-in');
    }
    setAuthMessage('Signed in', 'success');
  } else {
    loggedOutView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
    if (accountStatus) {
      accountStatus.textContent = 'Not signed in';
      accountStatus.classList.remove('signed-in');
    }
    setAuthMessage('', '');
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

function initAccordions() {
  accordionHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      const section = header.getAttribute('data-section');
      const content = document.getElementById(`${section}-content`);
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      
      // Toggle current section
      header.setAttribute('aria-expanded', !isExpanded);
      if (content) {
        content.classList.toggle('collapsed', isExpanded);
      }
    });
  });
}

function initPasswordToggle() {
  if (!passwordToggle || !authPasswordInput) return;
  
  const eyeOpen = passwordToggle.querySelector('.eye-open');
  const eyeClosed = passwordToggle.querySelector('.eye-closed');
  
  passwordToggle.addEventListener('click', () => {
    const isPassword = authPasswordInput.type === 'password';
    authPasswordInput.type = isPassword ? 'text' : 'password';
    
    if (eyeOpen && eyeClosed) {
      eyeOpen.style.display = isPassword ? 'none' : 'block';
      eyeClosed.style.display = isPassword ? 'block' : 'none';
    }
    
    passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
}

function initForgotPassword() {
  if (!forgotPasswordLink) return;
  
  forgotPasswordLink.addEventListener('click', async () => {
    const email = authEmailInput?.value?.trim();
    
    if (!email) {
      setAuthMessage('Enter your email address first', 'error');
      authEmailInput?.focus();
      return;
    }
    
    if (!window.LockInAuth?.resetPassword) {
      setAuthMessage('Password reset is not available. Contact support.', 'error');
      return;
    }
    
    disableAuthInputs();
    setAuthMessage('Sending reset email...', 'success');
    
    try {
      await window.LockInAuth.resetPassword(email);
      setAuthMessage('Check your email for a password reset link.', 'success');
    } catch (error) {
      console.error('Password reset error:', error);
      setAuthMessage(error?.message || 'Failed to send reset email. Try again.', 'error');
    } finally {
      enableAuthInputs();
    }
  });
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

    if (!email) {
      setAuthMessage('Email is required', 'error');
      return;
    }

    if (!password) {
      setAuthMessage('Password is required', 'error');
      return;
    }

    disableAuthInputs();
    setAuthLoading(true);
    
    const statusMsg = currentAuthMode === 'signup' ? 'Creating account...' : 'Signing you in...';
    setAuthMessage(statusMsg, 'success');
    
    try {
      if (currentAuthMode === 'login') {
        await window.LockInAuth.signInWithEmail(email, password);
      } else {
        await window.LockInAuth.signUpWithEmail(email, password);
      }
      setAuthMessage("You're signed in. Highlight text to start!", 'success');
      
      if (authPasswordInput) {
        authPasswordInput.value = '';
      }
      refreshAuthView();
    } catch (error) {
      console.error('Lock-in auth sign-in error:', error);
      setAuthMessage(getFriendlyAuthError(error), 'error');
    } finally {
      enableAuthInputs();
      setAuthLoading(false);
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

// ============================================================================
// Privacy Section
// ============================================================================

const TELEMETRY_OPT_OUT_KEY = 'lockin_telemetry_disabled';

/**
 * Check if this is an unpacked/development extension
 */
function isDevelopmentExtension() {
  try {
    const manifest = chrome.runtime.getManifest();
    // Unpacked extensions don't have update_url
    return !manifest.update_url;
  } catch {
    return true;
  }
}

/**
 * Initialize the privacy section with telemetry toggle and dev-only test button
 */
async function initPrivacySection() {
  const toggle = document.getElementById('telemetry-toggle');
  const testBtn = document.getElementById('sentry-test-button');

  if (!toggle) return;

  // Load current telemetry state
  try {
    const result = await chrome.storage.sync.get([TELEMETRY_OPT_OUT_KEY]);
    toggle.checked = result[TELEMETRY_OPT_OUT_KEY] !== true;
  } catch {
    toggle.checked = true; // Default to enabled
  }

  // Save on change
  toggle.addEventListener('change', async () => {
    try {
      await chrome.storage.sync.set({ [TELEMETRY_OPT_OUT_KEY]: !toggle.checked });
      showStatus(
        toggle.checked ? 'Error reporting enabled' : 'Error reporting disabled',
        'success'
      );
    } catch (error) {
      console.error('Failed to save telemetry preference:', error);
      showStatus('Failed to save preference', 'error');
    }
  });

  // Dev-only: show test button for unpacked extensions
  if (testBtn && isDevelopmentExtension()) {
    testBtn.style.display = 'block';
    testBtn.addEventListener('click', () => {
      if (window.LockInSentry && window.LockInSentry.isSentryInitialized()) {
        const result = window.LockInSentry.sendTestEvents();
        showStatus(result.message, result.success ? 'success' : 'error');
      } else {
        showStatus('Sentry not initialized - check DSN config', 'error');
      }
    });
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initPasswordToggle();
  initForgotPassword();
  initAuthSection();
  initPrivacySection();
});
