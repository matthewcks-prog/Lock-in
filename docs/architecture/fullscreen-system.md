# Fullscreen System Notes

The fake fullscreen behavior is implemented in the extension content-script layer so sidebar controls remain available while videos are enlarged.

## Current Design

- Entry point: `extension/content/fakeFullscreen.js`
- Bootstrap integration: `extension/contentScript-react.js`
- Styling source: `extension/contentScript/fake-fullscreen.css`
- Generated CSS target: `extension/contentScript.css`

## Constraints

- Native browser fullscreen cannot render extension UI over the fullscreen surface.
- The extension therefore patches fullscreen requests for video-like elements and applies CSS-driven fullscreen.
- Non-video elements still use native fullscreen.

## Operational Guarantees

- Fullscreen patching is reversible via `destroy()`.
- Escape exits fake fullscreen.
- Sidebar open state controls visibility of the fake fullscreen exit button.
- Existing content script bootstrap flow remains intact.
