# Fake Fullscreen

> Status: implemented in extension content scripts

## Summary

The extension intercepts fullscreen requests for video-like elements and simulates fullscreen with CSS. This keeps the Lock-in sidebar available during playback.

## Why this approach

Chrome extensions cannot reliably draw extension UI over native fullscreen content. CSS-based fullscreen keeps playback large while preserving sidebar controls.

## Implementation

- Runtime controller: `extension/content/fakeFullscreen.js`
- Bootstrap hook: `extension/contentScript-react.js`
- Styles: `extension/contentScript/fake-fullscreen.css`
- Manifest registration: `extension/manifest.json`

## Behavior

1. Video-like elements (`<video>`, `<iframe>`, or containers containing `<video>`) are intercepted.
2. Fake fullscreen adds layout classes instead of entering native fullscreen.
3. Escape exits fake fullscreen.
4. A floating "Exit Fullscreen" button is shown only when the sidebar is open.
5. Non-video elements still call the native fullscreen API.

## Testing

Unit tests live in `extension/content/__tests__/fakeFullscreen.test.js` and cover patching, activation/deactivation, keyboard handling, and cleanup.
