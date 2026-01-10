# Transcript System Map

## A) Transcript System Map

### Entrypoints & UI Flow

1. **UI trigger**
   - `ui/extension/LockInSidebar.tsx` renders the Transcript toolbar button and opens the transcript panel.
   - `handleTranscriptClick()` calls `detectAndAutoExtract()` in `useTranscripts`.

2. **Hook layer**
   - `ui/extension/transcripts/useTranscripts.ts` orchestrates detection, extraction, and AI fallback.
   - Key entry points: `detectAndAutoExtract()`, `extractTranscript()`, `transcribeWithAI()`.

3. **Detection flow**
   - `performDetection()` builds a `VideoDetectionContext` and calls `detectVideosSync()`.
   - Panopto detection scans iframes, links, and redirect pages; HTML5 detection scans `<video>` elements.

4. **Extraction flow**
   - `extractTranscript()` sends `EXTRACT_TRANSCRIPT` to background.
   - Background routes to `extractPanoptoTranscript()` or `extractHtml5Transcript()`.
   - If captions are missing, the UI surfaces AI transcription fallback.

5. **AI fallback trigger**
   - `transcribeWithAI()` uses `FETCH_PANOPTO_MEDIA_URL` for Panopto videos without a media URL.
   - On success, `TRANSCRIBE_MEDIA_AI` streams media to the backend for Whisper transcription.

### Detection Layer

1. **Core detection function**
   - `core/transcripts/videoDetection.ts` exports `detectVideosSync(context)`.
   - Output: `{ videos, provider, requiresApiCall }`.

2. **Detection strategy**
   - **Panopto**: iframes + anchor links + LMS redirect pages.
   - **HTML5**: `<video>` elements + `<track>` captions, plus DRM hints.

3. **Context building**
   - `collectIframeInfo()` gathers iframe metadata.
   - `buildDetectionContext()` wires `pageUrl`, `iframes`, and `document`.

### Provider Architecture

1. **Provider interface**
   - `core/transcripts/providerRegistry.ts` defines `TranscriptProviderV2` and a registry.
   - Registry exists, but detection uses direct function calls in `detectVideosSync()`.

2. **Registered providers**
   - `PanoptoProvider` in `core/transcripts/providers/panoptoProvider.ts` handles caption extraction (VTT).

3. **Background extractors**
   - `extension/background.js` implements `extractPanoptoTranscript()` and `extractHtml5Transcript()`.
   - HTML5 DOM caption parsing lives in `ui/extension/transcripts/extractHtml5TranscriptFromDom.ts`.

### Transcript Data Model

- `core/transcripts/types.ts`
  - `VideoProvider = 'panopto' | 'html5' | 'youtube' | 'unknown'`
  - `DetectedVideo` includes Panopto metadata (`panoptoTenant`) and HTML5 fields (`mediaUrl`, `trackUrls`).
  - `TranscriptResult` + `TranscriptSegment` represent parsed transcript data.

### Network & Auth

1. **Background fetch helpers**
   - `fetchWithRetry()` + `fetchWithCredentials()` in `extension/background.js`.
   - `fetchVttContent()` for caption files.

2. **Background message handlers**
   - `EXTRACT_TRANSCRIPT` -> `handleTranscriptExtraction()`.
   - `FETCH_PANOPTO_MEDIA_URL` -> `handlePanoptoMediaUrlFetch()` -> `PanoptoMediaResolver`.
   - `TRANSCRIBE_MEDIA_AI` -> AI transcription pipeline.

3. **PanoptoMediaResolver flow**
   - Fetch Viewer/Embed HTML for explicit podcast/download URLs and `og:video` tags.
   - If missing, run `chrome.scripting.executeScript` in MAIN world to inspect runtime state.
   - Validate candidates with `GET` + `Range: bytes=0-0`, capture final CDN URL.
   - Emits structured logs with job IDs and returns clear error codes.

### Storage / Caching

- No persistent transcript cache in the extension (stored in React state only).
- Session storage is scoped to `lockin_session_${tabId}` in background.

---

## B) Symbol Index

| Symbol                       | File Path                                       | Purpose                                                    |
| ---------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `LockInSidebar`              | `ui/extension/LockInSidebar.tsx`                | Transcript button + panel host                             |
| `useTranscripts`             | `ui/extension/transcripts/useTranscripts.ts`    | Detect/extract + AI fallback orchestration                 |
| `detectVideosSync`           | `core/transcripts/videoDetection.ts`            | Panopto + HTML5 detection                                  |
| `PanoptoProvider`            | `core/transcripts/providers/panoptoProvider.ts` | Panopto caption extraction                                 |
| `extractPanoptoTranscript`   | `extension/background.js`                       | Background Panopto caption fetch + parse                   |
| `extractHtml5Transcript`     | `extension/background.js`                       | Background HTML5 caption fetch + parse                     |
| `handlePanoptoMediaUrlFetch` | `extension/background.js`                       | Panopto AI media URL entrypoint                            |
| `PanoptoMediaResolver`       | `extension/background.js`                       | Viewer/embed parsing + MAIN-world probe + range validation |
| `panoptoRuntimeProbe`        | `extension/background.js`                       | MAIN-world probe used by `chrome.scripting.executeScript`  |
| `fetchWithCredentials`       | `extension/background.js`                       | Authenticated HTML/VTT fetch helper                        |
| `transcribeWithAI`           | `ui/extension/transcripts/useTranscripts.ts`    | Starts AI transcription pipeline                           |

---

## C) AI Transcription Flow (Panopto)

1. `useTranscripts` detects `NO_CAPTIONS` and exposes AI fallback.
2. `transcribeWithAI` triggers `FETCH_PANOPTO_MEDIA_URL` if `mediaUrl` is missing.
3. `PanoptoMediaResolver` resolves a downloadable URL and validates access.
4. `TRANSCRIBE_MEDIA_AI` streams media to the backend for Whisper transcription.
