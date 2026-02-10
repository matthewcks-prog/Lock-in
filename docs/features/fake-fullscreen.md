# Fake Fullscreen — Architecture

> **Status**: Implemented | **Date**: 2026-02-08

## Overview

When the Lock-in sidebar is open and a video element requests native fullscreen, the extension intercepts the call and simulates fullscreen with CSS instead. The video fills the content area (left of the sidebar) while the sidebar stays visible and interactive.

A floating "Exit Fullscreen" toggle button appears so the user can leave the fake-fullscreen state at any time. Pressing **Escape** also exits.

## Why Not Native Fullscreen?

Browser security constraints prevent Chrome extensions from rendering UI over native fullscreen content. The `requestFullscreen()` API puts the element into a separate rendering layer that extensions cannot overlay. Our solution **simulates** fullscreen using CSS positioning, which keeps the video large while preserving full sidebar functionality.

## Architecture

### Files

| File                                                    | Layer     | Purpose                                                                                  |
| ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `extension/content/fakeFullscreen.js`                   | Extension | Content script — patches `requestFullscreen`, manages CSS classes, injects toggle button |
| `extension/contentScript.css` (fake fullscreen section) | Extension | Layout rules for `.lockin-fake-fullscreen-video`, toggle button styling                  |
| `extension/contentScript-react.js`                      | Extension | Bootstrap — creates and initializes the fake fullscreen module                           |

### How It Works

1. **Interception** — `Element.prototype.requestFullscreen` is patched. When the sidebar is open and a video-like element calls `requestFullscreen()`, the call is intercepted.
2. **CSS simulation** — The video element gets the class `lockin-fake-fullscreen-video` (fixed position, fills `--lockin-content-width × 100vh`). `body` gets `lockin-fake-fullscreen` to hide scrollbars and pin the page wrapper.
3. **Toggle button** — A `<button>` with id `lockin-fake-fs-toggle` is injected into the page. It's shown when active, hidden when not.
4. **Exit** — Clicking the toggle button or pressing Escape calls `deactivate()`, which removes all CSS classes and restores the original element styles.
5. **Passthrough** — If the sidebar is NOT open, or the element is not video-like, the original `requestFullscreen` is called normally.

### No Sidebar UI Changes

The sidebar UI is **unchanged** — there are no immersive controls, hooks, or domain models. The fake fullscreen is entirely self-contained in the content script layer.
