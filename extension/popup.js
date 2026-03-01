/* eslint-disable max-lines -- Popup script coordinates auth, compliance, privacy, and data controls in one load-order sensitive entrypoint. */
if (typeof window !== 'undefined' && window.LockInSentry) window.LockInSentry.initSentry('popup');

const statusMessage = document.getElementById('status-message'),
  authForm = document.getElementById('auth-form'),
  authEmailInput = document.getElementById('auth-email'),
  authPasswordInput = document.getElementById('auth-password'),
  authMessage = document.getElementById('auth-message'),
  loggedOutView = document.getElementById('auth-view-logged-out'),
  loggedInView = document.getElementById('auth-view-logged-in'),
  authUserEmail = document.getElementById('auth-user-email'),
  logoutButton = document.getElementById('logout-button'),
  sendFeedbackLink = document.getElementById('send-feedback-link'),
  authTabs = document.querySelectorAll('.auth-tab'),
  authSubmitButton = document.getElementById('auth-submit-button'),
  authModeHint = document.getElementById('auth-mode-hint'),
  passwordToggle = document.getElementById('password-toggle'),
  forgotPasswordLink = document.getElementById('forgot-password-link'),
  accountStatus = document.getElementById('account-status'),
  accordionHeaders = document.querySelectorAll('.accordion-header');

let currentAuthMode = 'login';
let isAuthLoading = false;

const { showStatus, setAuthMessage, getFriendlyAuthError, isSupabaseConfigured } =
  window.LockInPopupUtils;

window.LockInPopup = window.LockInPopup || {};
window.LockInPopup.showStatus = showStatus;

function toSafeErrorLog(error) {
  if (error instanceof Error) {
    const typedError = error;
    return {
      name: typedError.name,
      message: typedError.message,
      stack: typedError.stack ? '[stack omitted]' : undefined,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const record = error;
    return {
      message:
        typeof record['message'] === 'string' ? record['message'] : 'Unexpected popup error object',
      code: record['code'],
    };
  }
  return { message: String(error) };
}

function logPopupError(message, error) {
  console.error(message, toSafeErrorLog(error));
}

function isSignupConsentSatisfied() {
  if (currentAuthMode !== 'signup') {
    return true;
  }
  return window.LockInPopupCompliance?.isSignupConsentChecked?.() === true;
}

function updateAuthSubmitAvailability() {
  if (!authSubmitButton) return;
  authSubmitButton.disabled = isAuthLoading || !isSignupConsentSatisfied();
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

  window.LockInPopupCompliance?.setAuthMode?.(currentAuthMode);
  updateAuthSubmitAvailability();
}
function setAuthLoading(isLoading) {
  if (!authSubmitButton) return;
  isAuthLoading = isLoading;

  const btnText = authSubmitButton.querySelector('.btn-text');
  const btnSpinner = authSubmitButton.querySelector('.btn-spinner');

  if (isLoading) {
    authSubmitButton.classList.add('loading');
    if (btnText) btnText.style.opacity = '0';
    if (btnSpinner) btnSpinner.style.display = 'flex';
  } else {
    authSubmitButton.classList.remove('loading');
    if (btnText) btnText.style.opacity = '1';
    if (btnSpinner) btnSpinner.style.display = 'none';
  }
  updateAuthSubmitAvailability();
}
async function refreshAuthView() {
  if (!window.LockInAuth || !loggedInView || !loggedOutView) {
    return;
  }

  const session = await window.LockInAuth.getSession();
  const hasSession = Boolean(session?.accessToken);
  if (hasSession) {
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
  } else {
    loggedOutView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
    if (accountStatus) {
      accountStatus.textContent = 'Not signed in';
      accountStatus.classList.remove('signed-in');
    }
  }
  window.LockInPopupDataControls?.setSignedInState?.(hasSession);
  setAuthMessage(hasSession ? 'Signed in' : '', hasSession ? 'success' : '');
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
      logPopupError('Password reset error:', error);
      setAuthMessage(error?.message || 'Failed to send reset email. Try again.', 'error');
    } finally {
      enableAuthInputs();
    }
  });
}

function bindAuthModeTabs() {
  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      currentAuthMode = tab.getAttribute('data-mode') || 'login';
      updateAuthModeUI();
    });
  });
  updateAuthModeUI();
}

function validateAuthInputs(email, password) {
  if (!email) return 'Email is required';
  if (!password) return 'Password is required';
  if (!isSignupConsentSatisfied()) {
    return 'You must agree to the Terms of Service and Privacy Policy to create an account.';
  }
  return null;
}

async function submitAuthCredentials(email, password) {
  if (currentAuthMode === 'login') {
    await window.LockInAuth.signInWithEmail(email, password);
  } else {
    await window.LockInAuth.signUpWithEmail(email, password);
  }
}

function createAuthSubmitHandler() {
  return async (event) => {
    event.preventDefault();
    const email = authEmailInput?.value?.trim();
    const password = authPasswordInput?.value || '';
    const validationError = validateAuthInputs(email, password);
    if (validationError) {
      setAuthMessage(validationError, 'error');
      return;
    }

    disableAuthInputs();
    setAuthLoading(true);
    const statusMsg = currentAuthMode === 'signup' ? 'Creating account...' : 'Signing you in...';
    setAuthMessage(statusMsg, 'success');
    try {
      await submitAuthCredentials(email, password);
      setAuthMessage("You're signed in. Highlight text to start!", 'success');
      if (authPasswordInput) authPasswordInput.value = '';
      refreshAuthView();
    } catch (error) {
      logPopupError('Lock-in auth sign-in error:', error);
      setAuthMessage(getFriendlyAuthError(error), 'error');
    } finally {
      enableAuthInputs();
      setAuthLoading(false);
    }
  };
}

function createLogoutHandler() {
  return async () => {
    disableAuthInputs();
    try {
      await window.LockInAuth.signOut();
      setAuthMessage('Signed out', 'success');
      refreshAuthView();
    } catch (error) {
      logPopupError('Lock-in auth sign-out error:', error);
      setAuthMessage('Failed to sign out', 'error');
    } finally {
      enableAuthInputs();
    }
  };
}

function initAuthSection() {
  if (!authForm || !window.LockInAuth) {
    return;
  }

  if (!isSupabaseConfigured()) {
    disableAuthInputs();
    setAuthMessage(
      'Configure VITE_SUPABASE_URL_DEV and VITE_SUPABASE_ANON_KEY_DEV in .env, then rebuild the extension.',
      'error',
    );
    return;
  }
  bindAuthModeTabs();
  authForm.addEventListener('submit', createAuthSubmitHandler());

  if (logoutButton) {
    logoutButton.addEventListener('click', createLogoutHandler());
  }
  window.LockInAuth.onSessionChanged(() => {
    refreshAuthView();
  });
  refreshAuthView();
}

function initHelpSection() {
  if (!sendFeedbackLink) return;

  sendFeedbackLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_FEEDBACK' }, (response) => {
        if (chrome.runtime.lastError) {
          logPopupError('[Lock-in] Failed to send OPEN_FEEDBACK:', chrome.runtime.lastError);
          showStatus('Could not open feedback form. Please ensure the page is loaded.', 'error');
        } else if (response?.success) {
          window.close();
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.LockInPopupCompliance?.initComplianceSection?.({
    onSignupConsentChanged: updateAuthSubmitAvailability,
  });
  void window.LockInPopupDataControls?.initDataControlsSection?.({
    showStatus,
    getSession: () => window.LockInAuth?.getSession?.(),
  });
  initAccordions();
  initPasswordToggle();
  initForgotPassword();
  initAuthSection();
  initHelpSection();
  window.LockInPopupPrivacy?.initPrivacySection?.();
});
