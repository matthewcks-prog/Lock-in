if (typeof window !== 'undefined' && window.LockInSentry) {
  window.LockInSentry.initSentry('popup');
}

const statusMessage = document.getElementById('status-message'),
  authForm = document.getElementById('auth-form'),
  authEmailInput = document.getElementById('auth-email'),
  authPasswordInput = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message'),
  loggedOutView = document.getElementById('auth-view-logged-out'),
  loggedInView = document.getElementById('auth-view-logged-in'),
  authUserEmail = document.getElementById('auth-user-email');
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
const STATUS_AUTO_HIDE_DELAY_MS = 2000;

let currentAuthMode = 'login';

function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, STATUS_AUTO_HIDE_DELAY_MS);
}
window.LockInPopup = window.LockInPopup || {};
window.LockInPopup.showStatus = showStatus;

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
  return !email ? 'Email is required' : !password ? 'Password is required' : null;
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
      console.error('Lock-in auth sign-in error:', error);
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
      console.error('Lock-in auth sign-out error:', error);
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

document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initPasswordToggle();
  initForgotPassword();
  initAuthSection();
  window.LockInPopupPrivacy?.initPrivacySection?.();
});
