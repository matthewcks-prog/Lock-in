/**
 * Utility functions for Lock-in Popup Auth
 */
window.LockInPopupUtils = (function () {
  const STATUS_AUTO_HIDE_DELAY_MS = 2000;

  function showStatus(message, type = 'success') {
    const statusMessage = document.getElementById('status-message');
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, STATUS_AUTO_HIDE_DELAY_MS);
  }

  function setAuthMessage(message, type = 'error') {
    const authMessage = document.getElementById('auth-message');
    if (!authMessage) return;
    authMessage.textContent = message || '';
    authMessage.className = `auth-message ${type}`.trim();
  }

  function getFriendlyAuthError(error) {
    const code = error?.code;
    const errors = {
      INVALID_LOGIN: 'Incorrect email or password. Please try again.',
      EMAIL_NOT_CONFIRMED: 'Confirm your email address before signing in.',
      EMAIL_CONFIRMATION_REQUIRED:
        'We sent you a confirmation email. Please verify it, then sign in.',
      INVALID_EMAIL: 'Enter a valid email address.',
      USER_ALREADY_REGISTERED: 'An account already exists for this email. Try logging in instead.',
    };
    return errors[code] || error?.message || "We couldn't sign you in. Please try again.";
  }

  function isSupabaseConfigured() {
    const config = window.LOCKIN_CONFIG || {};
    const url = config.SUPABASE_URL || '';
    const anonKey = config.SUPABASE_ANON_KEY || '';
    const urlLooksValid = url && !url.includes('YOUR-PROJECT');
    const keyLooksValid = anonKey && anonKey !== 'public-anon-key';
    return Boolean(urlLooksValid && keyLooksValid);
  }

  return {
    showStatus,
    setAuthMessage,
    getFriendlyAuthError,
    isSupabaseConfigured,
  };
})();
