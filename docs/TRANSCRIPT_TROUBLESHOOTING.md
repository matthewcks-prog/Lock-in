# Transcript Extraction Troubleshooting Guide

This guide helps diagnose and resolve issues with transcript extraction from video platforms (Panopto, Echo360, HTML5).

## Quick Diagnosis

### Check Console Logs

1. **Open Browser Console** (F12 or Right-click → Inspect → Console)
2. **Look for Lock-in logs** - All transcript-related logs are prefixed with `[Lock-in Transcript:...]` or `[Lock-in]`
3. **Check Background Service Worker**:
   - Go to `chrome://extensions`
   - Find "Lock-in"
   - Click "service worker" link
   - Check console for background logs

### Common Error Patterns

Look for these patterns in console logs:

```
[Lock-in Transcript:Panopto] Error: ...
[Lock-in Transcript:Echo360] Error: ...
[Lock-in] extractPanoptoTranscript error: ...
[Lock-in] Fetching (attempt X/4): ...
[Lock-in] Response status: XXX ...
```

## Error Code Reference

### `AUTH_REQUIRED` / `LOCKIN_AUTH_REQUIRED`

**Meaning**: Authentication required to access the video platform.

**User Message**: "Authentication required. Please log in to [Platform]."

**Solutions**:

1. Ensure you're logged into the video platform (Panopto/Echo360) in the same browser
2. Refresh the page and try again
3. Check if your session expired - log out and log back in
4. For Panopto: Ensure you're accessing the video through your institution's portal

**Console Indicators**:

- HTTP 401 or 403 responses
- Redirects to login pages
- "AUTH_REQUIRED" in error messages

---

### `TIMEOUT`

**Meaning**: Request took longer than 30 seconds to complete.

**User Message**: "Request timeout. The server took too long to respond."

**Solutions**:

1. Check your internet connection speed
2. Try again - the server may have been temporarily slow
3. If consistently timing out, the video platform may be experiencing issues
4. Check if your network has firewall restrictions

**Console Indicators**:

- "AbortError" in error messages
- "timeout" in error messages
- Logs showing "Fetching (attempt X/4)" but no response

**Technical Details**:

- Default timeout: 30 seconds
- Retry attempts: 3 (4 total attempts)
- Uses exponential backoff between retries

---

### `NETWORK_ERROR`

**Meaning**: Network connectivity issue or CORS restriction.

**User Message**: "Network error. Please check your internet connection and ensure you're logged into [Platform]."

**Solutions**:

1. Check your internet connection
2. Disable VPN if active (may cause CORS issues)
3. Check browser extensions that might block requests
4. Try a different network
5. Clear browser cache and cookies
6. Ensure you're logged into the video platform

**Console Indicators**:

- "Failed to fetch" in error messages
- "NetworkError" in error messages
- "CORS" in error messages
- "Network request failed" in error messages

**Technical Details**:

- Background service worker handles CORS automatically
- If you see CORS errors, the background script may not be running

---

### `NO_CAPTIONS`

**Meaning**: Video has no captions/transcripts available.

**User Message**: "This video has no captions available."

**Solutions**:

1. Use AI transcription fallback (if available)
2. Contact your instructor to request captions
3. Check if captions are enabled for this video on the platform

**Console Indicators**:

- "No captions found" in logs
- Caption URL extraction returns null
- Video metadata shows `hasCaptions: false`

---

### `PARSE_ERROR`

**Meaning**: Caption file format is invalid or couldn't be parsed.

**User Message**: "Failed to extract transcript: [error details]"

**Solutions**:

1. Try AI transcription fallback (if available)
2. Report the issue with console logs
3. The caption file format may be unsupported

**Console Indicators**:

- WebVTT parsing errors
- JSON parsing errors
- "Invalid format" in error messages

**Technical Details**:

- Supports WebVTT, JSON, and plain text formats
- HTML entity decoding is applied automatically

---

### `INVALID_VIDEO`

**Meaning**: Video data is invalid or missing required information.

**User Message**: "Invalid video data."

**Solutions**:

1. Refresh the page and try again
2. Ensure the video is fully loaded
3. Try a different video to isolate the issue

**Console Indicators**:

- Missing video ID or embed URL
- Invalid video metadata
- Video detection failed

---

### `INVALID_RESPONSE`

**Meaning**: Server returned an unexpected response format.

**User Message**: "Invalid response from server."

**Solutions**:

1. Try again - may be a temporary server issue
2. Check if the video platform is experiencing issues
3. Report the issue with console logs

---

### `MEDIA_PROCESSING` / `MEDIA_FAILED` / `MEDIA_PRELIMINARY` / `MEDIA_HIDDEN`

**Meaning**: Video media is in a non-ready state (Echo360 specific).

**User Message**:

- `MEDIA_PROCESSING`: "Video is still processing. Please try again later."
- `MEDIA_FAILED`: "Video processing failed."
- `MEDIA_PRELIMINARY`: "Video has preliminary captions only."
- `MEDIA_HIDDEN`: "Video captions are hidden."

**Solutions**:

1. Wait for processing to complete (for `MEDIA_PROCESSING`)
2. Contact support if `MEDIA_FAILED`
3. Use AI transcription fallback if available

---

### `NOT_AVAILABLE`

**Meaning**: Transcripts are not available for this video.

**User Message**: "Transcripts are not available for this video."

**Solutions**:

1. Use AI transcription fallback (if available)
2. Check if transcripts are enabled for this video

---

## Step-by-Step Debugging

### 1. Verify Extension is Loaded

1. Go to `chrome://extensions`
2. Ensure "Lock-in" is enabled
3. Check for any errors in the extension details

### 2. Check Background Service Worker

1. Go to `chrome://extensions`
2. Find "Lock-in"
3. Click "service worker" link
4. Check console for errors
5. Look for transcript-related logs

### 3. Check Content Script Console

1. Open the page with the video
2. Open browser console (F12)
3. Look for `[Lock-in]` or `[Lock-in Transcript:...]` logs
4. Check for any red error messages

### 4. Verify Video Detection

Look for logs like:

```
[Lock-in Transcript:Panopto] Detected video: { id: "...", embedUrl: "..." }
[Lock-in Transcript:Echo360] Detected video: { id: "...", baseUrl: "..." }
```

If no detection logs appear:

- Video may not be on a supported platform
- Page structure may have changed
- Extension may not be injecting correctly

### 5. Check Network Requests

1. Open DevTools → Network tab
2. Filter by "XHR" or "Fetch"
3. Look for requests to:
   - Panopto: `GetCaptionVTT.ashx`, `Viewer`, `Embed`
   - Echo360: `/api/ui/echoplayer/...`, `/syllabus`
4. Check response status codes:
   - 200: Success
   - 401/403: Authentication required
   - 404: Not found
   - 500: Server error
   - Timeout: Request took too long

### 6. Verify Authentication

1. Ensure you're logged into the video platform
2. Try accessing the video directly in a new tab
3. Check if your session is still valid
4. Look for redirects to login pages in Network tab

## Common Root Causes

### 1. Session Expired

**Symptoms**: `AUTH_REQUIRED` errors

**Solution**: Log out and log back into the video platform

### 2. Network Issues

**Symptoms**: `NETWORK_ERROR` or `TIMEOUT` errors

**Solution**:

- Check internet connection
- Disable VPN
- Try different network
- Check firewall settings

### 3. Video Platform Changes

**Symptoms**: Detection fails, unexpected errors

**Solution**:

- Report the issue with console logs
- Platform may have updated their structure
- Extension may need updates

### 4. CORS Restrictions

**Symptoms**: `NETWORK_ERROR` with CORS messages

**Solution**:

- Background service worker should handle this automatically
- If you see CORS errors, background script may not be running
- Check `chrome://extensions` for service worker status

### 5. Caption Format Issues

**Symptoms**: `PARSE_ERROR` errors

**Solution**:

- Use AI transcription fallback
- Report the issue with the caption file URL

## AI Transcription Fallback

If caption extraction fails, AI transcription may be available:

1. Look for "AI transcription available" message
2. Click the AI transcription button
3. Wait for processing (may take several minutes)
4. Transcript will appear when ready

**Note**: AI transcription requires:

- Media URL to be accessible
- Backend service to be running
- OpenAI API to be configured

## Getting Help

If issues persist:

1. **Collect Information**:
   - Console logs (from both content script and background worker)
   - Network tab requests/responses
   - Error messages shown to user
   - Video platform and URL
   - Browser version

2. **Check Known Issues**:
   - Review `docs/STATUS.md` for recent changes
   - Check `TRANSCRIPT_FIX_SUMMARY.md` for recent fixes

3. **Report Issue**:
   - Include all collected information
   - Describe steps to reproduce
   - Mention which video platform (Panopto/Echo360/HTML5)

## Technical Details

### Retry Logic

- **Max retries**: 3 attempts (4 total)
- **Timeout**: 30 seconds per request
- **Backoff**: Exponential with jitter
  - Base delay: 500ms
  - Max delay: 5000ms
  - Formula: `min(baseDelay * 2^attempt + jitter, maxDelay)`

### Supported Formats

- **WebVTT** (.vtt files)
- **JSON** (Echo360 API responses)
- **Plain Text** (.txt files)

### Platform Support

- **Panopto**: Full support (captions + AI fallback)
- **Echo360**: Full support (JSON/VTT/TXT + AI fallback)
- **HTML5**: Basic support (textTracks API)

### Logging Levels

- **Error**: Critical failures
- **Warn**: Recoverable issues
- **Info**: Normal operation
- **Debug**: Detailed debugging (requires `DEBUG=true` in config)

Enable debug logging by setting `VITE_DEBUG=true` in the root `.env` and rebuilding the extension config.
