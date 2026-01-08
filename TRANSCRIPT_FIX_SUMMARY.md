# Transcript Extraction Network Error - Fix Summary

**Date:** 2026-01-04  
**Issue:** "Network error. Please check your connection. (AI transcription available as fallback)"

## Problem Analysis

The error occurred during transcript extraction from Panopto videos. The root causes could be:

1. **Network timeout** - Requests hanging without timeout handling
2. **Poor error messages** - Generic "Failed to fetch" not actionable
3. **Insufficient retries** - Only 2 retry attempts
4. **Limited logging** - Hard to debug what's actually failing
5. **Missing error classification** - Timeout vs auth vs network errors all bundled together

## Solutions Implemented

### 1. Enhanced Network Request Handling

**File: `extension/background.js`**

#### Before:

```javascript
// Only 2 retries, no timeout
async function fetchWithRetry(url, options, maxRetries = 2) {
  // No timeout, just basic fetch
  const response = await fetch(url, options);
  // Limited error handling
}
```

#### After:

```javascript
// 3 retries with 30s timeout
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  timeoutMs: 30000, // NEW: 30 second timeout
};

async function fetchWithRetry(url, options, maxRetries = 3, timeoutMs = 30000) {
  // NEW: AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = {
    ...options,
    signal: controller.signal,
  };

  // NEW: Comprehensive logging
  console.log(`[Lock-in] Fetching (attempt ${attempt + 1}/${maxRetries + 1}): ${url}`);
  const response = await fetch(url, fetchOptions);
  console.log(`[Lock-in] Response status: ${response.status} ${response.statusText}`);

  // NEW: Timeout-specific error handling
  if (error.name === 'AbortError') {
    lastError = new Error(`Request timeout after ${timeoutMs}ms`);
  }
}
```

**Benefits:**

- ✅ Requests won't hang indefinitely (30s timeout)
- ✅ More retry attempts for transient failures (3 vs 2)
- ✅ Clear logging for debugging
- ✅ Timeout errors are specifically identified

### 2. Improved Error Messages

**File: `extension/background.js` - `extractPanoptoTranscript()`**

#### Before:

```javascript
catch (error) {
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return {
      error: "Network error. Please check your connection.",
      errorCode: "NETWORK_ERROR",
    };
  }
}
```

#### After:

```javascript
catch (error) {
  // NEW: Comprehensive logging
  console.error('[Lock-in] extractPanoptoTranscript error:', message, error);

  // NEW: Timeout-specific error
  if (message.includes("timeout") || message.includes("AbortError")) {
    return {
      error: "Request timeout. The server took too long to respond.",
      errorCode: "TIMEOUT",
    };
  }

  // IMPROVED: More specific network error message
  if (message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("CORS")) {
    console.error('[Lock-in] Network error details:', {
      message,
      embedUrl: video.embedUrl,
      error: error.toString(),
    });
    return {
      error: "Network error. Please check your internet connection and ensure you're logged into Panopto.",
      errorCode: "NETWORK_ERROR",
    };
  }
}
```

**Benefits:**

- ✅ Timeout errors have specific message
- ✅ Network errors mention Panopto login requirement
- ✅ Detailed error logging for debugging
- ✅ CORS errors specifically caught

### 3. Request Validation & Headers

**File: `extension/background.js` - `fetchWithCredentials()` and `fetchVttContent()`**

#### Before:

```javascript
async function fetchWithCredentials(url) {
  const response = await fetchWithRetry(url, {
    credentials: 'include',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
}
```

#### After:

```javascript
async function fetchWithCredentials(url) {
  console.log('[Lock-in] fetchWithCredentials:', url.substring(0, 100));

  // NEW: URL validation
  try {
    new URL(url);
  } catch (e) {
    console.error('[Lock-in] Invalid URL:', url, e);
    throw new Error('Invalid URL provided');
  }

  const response = await fetchWithRetry(url, {
    credentials: 'include',
    mode: 'cors', // NEW: Explicit CORS mode
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Chrome Extension)', // NEW: User-Agent header
    },
  });

  // NEW: Response logging
  const text = await response.text();
  console.log(`[Lock-in] Fetched ${text.length} bytes successfully`);
}
```

**Benefits:**

- ✅ Invalid URLs caught before fetch attempt
- ✅ Explicit CORS mode for clarity
- ✅ User-Agent header for better server compatibility
- ✅ Response size logging for debugging

### 4. Caption Extraction Logging

**File: `core/transcripts/providers/panoptoProvider.ts` - `extractCaptionVttUrl()`**

#### After:

```typescript
export function extractCaptionVttUrl(html: string): string | null {
  // Try multiple patterns...
  for (let i = 0; i < patterns.length; i++) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = decodeEscapedUrl(match[1]);
      // NEW: Log which pattern matched
      console.log(`[Panopto] Caption URL found with pattern ${i + 1}:`, url.substring(0, 100));
      return url;
    }
  }

  // NEW: Log when no caption found
  console.warn('[Panopto] No caption URL found in embed HTML. HTML length:', html.length);
  console.log('[Panopto] HTML sample:', html.substring(0, 500).replace(/\s+/g, ' '));

  return null;
}
```

**Benefits:**

- ✅ Know which caption pattern worked
- ✅ See HTML sample when captions not found
- ✅ Easier to diagnose caption extraction failures

## Testing the Fix

### 1. Check Browser Console

Open Chrome DevTools (F12) and watch the Console tab. You should now see detailed logs:

**Successful extraction:**

```
[Lock-in] extractPanoptoTranscript starting for: {...}
[Lock-in] Step 1: Fetching embed page...
[Lock-in] fetchWithCredentials: https://monash.au.panopto.com/...
[Lock-in] Fetching (attempt 1/4): https://...
[Lock-in] Response status: 200 OK
[Lock-in] Embed page fetched successfully, length: 45823
[Lock-in] Step 2: Extracting caption URL...
[Panopto] Caption URL found with pattern 1: https://...
[Lock-in] Step 3: Fetching VTT content...
[Lock-in] VTT content fetched successfully, length: 12456
[Lock-in] Transcript extracted successfully: {segments: 234, ...}
```

**If timeout occurs:**

```
[Lock-in] Request timeout after 30000ms
Error: Request timeout. The server took too long to respond.
```

**If network error:**

```
[Lock-in] Fetch error (attempt 1): Failed to fetch
[Lock-in] Network error: Failed to fetch. Possible causes: CORS, DNS, or network connectivity
[Lock-in] Retrying in 500ms...
```

### 2. Test Different Scenarios

1. **Normal video with captions** - Should work and show detailed logs
2. **Video without captions** - Should show "No captions available" with AI fallback option
3. **Not logged into Panopto** - Should show "Authentication required" error
4. **Slow network** - Should retry 3 times before failing

### 3. Check Background Service Worker

For more detailed logging:

1. Go to `chrome://extensions`
2. Find "Lock-in"
3. Click "service worker" link
4. Check console for all background logs

## Documentation

Created comprehensive troubleshooting guide:

- **Location**: `docs/TRANSCRIPT_TROUBLESHOOTING.md`
- **Includes**:
  - Console log patterns
  - Error code reference
  - Step-by-step debugging guide
  - Common root causes and solutions

## Best Practices Followed

✅ **Timeout Handling**: Industry-standard 30s timeout using AbortController  
✅ **Retry Strategy**: Exponential backoff with 3 attempts  
✅ **Error Classification**: Specific error codes (TIMEOUT, NETWORK_ERROR, AUTH_REQUIRED, etc.)  
✅ **Logging**: Comprehensive but not overwhelming  
✅ **Validation**: URL and response validation  
✅ **User Feedback**: Actionable error messages  
✅ **Documentation**: Troubleshooting guide for users and developers

## Files Modified

1. `extension/background.js` - Main network handling improvements
2. `core/transcripts/providers/panoptoProvider.ts` - TypeScript provider improvements
3. `docs/TRANSCRIPT_TROUBLESHOOTING.md` - NEW troubleshooting guide
4. `docs/STATUS.md` - Updated with recent changes

## Next Steps

1. **Test the fix** - Try transcript extraction on various videos
2. **Monitor console logs** - Check if logs help identify issues
3. **Report findings** - If still failing, share console logs from the troubleshooting guide

If issues persist, check the troubleshooting guide at `docs/TRANSCRIPT_TROUBLESHOOTING.md`.
