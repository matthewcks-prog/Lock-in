# Transcript System Map

## A) Transcript System Map

### Entrypoints & UI Flow

1. **UI Trigger Point**
   - **File**: `ui/extension/LockInSidebar.tsx`
   - **Component**: `LockInSidebar` (line 218)
   - **Button**: "Transcript" button in chat toolbar (line 1160-1181)
   - **Handler**: `handleTranscriptClick` (line 441-444) → calls `detectAndAutoExtract()`

2. **Hook Layer**
   - **File**: `ui/extension/transcripts/useTranscripts.ts`
   - **Hook**: `useTranscripts()` (line 238)
   - **Key Functions**:
     - `detectAndAutoExtract()` (line 459) - Main entry point from UI
     - `performDetection()` (line 252) - Core detection logic
     - `extractTranscript()` (line 403) - Extraction orchestration
     - `performExtraction()` (line 366) - Background script communication

3. **Detection Flow**
   - `performDetection()` builds `VideoDetectionContext` from DOM (line 256-259)
   - Calls `detectVideosSync()` from `core/transcripts/videoDetection.ts` (line 262)
   - For Echo360 section pages: sends `FETCH_ECHO360_SYLLABUS` message to background (line 278-281)
   - Returns `DetectedVideo[]` array

4. **UI State Management**
   - **State Type**: `TranscriptState` (line 23-46 in useTranscripts.ts)
   - **States**:
     - `isVideoListOpen` - Shows video picker panel
     - `videos` - Detected videos array
     - `isDetecting` - Detection in progress
     - `isExtracting` - Extraction in progress
     - `extractingVideoId` - Which video is being extracted
     - `lastTranscript` - Last extracted transcript result
     - `error` - Error message
     - `authRequired` - Auth prompt info

5. **UI Rendering**
   - **Video List Panel**: `VideoListPanel` component (`ui/extension/transcripts/VideoListPanel.tsx`)
     - Rendered when `transcriptState.isVideoListOpen === true` (line 1244 in LockInSidebar.tsx)
     - Shows list of detected videos or loading/error states
   - **Transcript Display**: `TranscriptMessage` component (`ui/extension/transcripts/TranscriptMessage.tsx`)
     - Rendered when `transcriptState.lastTranscript` exists (line 1235 in LockInSidebar.tsx)
     - Shows transcript text with download/save options

### Detection Layer

1. **Core Detection Function**
   - **File**: `core/transcripts/videoDetection.ts`
   - **Function**: `detectVideosSync(context: VideoDetectionContext)` (line 232)
   - **Returns**: `VideoDetectionResult` (line 216-225)
     - `videos: DetectedVideo[]`
     - `provider: VideoProvider | null`
     - `requiresApiCall: boolean`
     - `echo360Context?: Echo360Context`

2. **Detection Strategy**
   - **Echo360 Detection** (line 236-268):
     - Extracts `Echo360Context` from URL using `extractEcho360Context()` (line 236)
     - Determines page type: `lesson` (single video) or `section` (needs API call)
     - For lesson pages: creates single `DetectedVideo` directly
     - For section pages: returns `requiresApiCall: true`
   - **Panopto Detection** (line 272-281):
     - Calls `detectPanoptoVideosFromIframes()` (line 272)
     - Scans iframes for Panopto embed URLs
     - Returns array of detected Panopto videos

3. **Context Building**
   - **Function**: `collectIframeInfo(doc: Document)` (line 300 in videoDetection.ts)
   - Collects all iframes from document (max depth 3)
   - Returns array of `{ src: string, title?: string }`

4. **Echo360 Async Detection**
   - **Background Message**: `FETCH_ECHO360_SYLLABUS` (line 279 in useTranscripts.ts)
   - **Handler**: `fetchEcho360Syllabus()` in `extension/background.js` (line 315)
   - **Caching**: In-memory Map cache with 5-minute TTL (line 291-293 in background.js)
   - **Cache Key**: `${echoOrigin}:${sectionId}` (line 301)

### Provider Architecture

1. **Provider Interface**
   - **File**: `core/transcripts/providerRegistry.ts`
   - **Interface**: `TranscriptProviderV2` (line 22-59)
     - `provider: VideoProvider` (readonly)
     - `canHandle(url: string): boolean`
     - `detectVideosSync(context: VideoDetectionContext): DetectedVideo[]`
     - `requiresAsyncDetection(context: VideoDetectionContext): boolean`
     - `detectVideosAsync?(context, fetcher): Promise<DetectedVideo[]>`
     - `extractTranscript?(video, fetcher): Promise<TranscriptExtractionResult>`

2. **Provider Registry**
   - **Class**: `ProviderRegistry` (line 78 in providerRegistry.ts)
   - **Global Instance**: `registry` (line 139)
   - **Functions**:
     - `registerProvider(provider)` (line 151)
     - `getProviderForUrl(url)` (line 158)
     - `detectVideosFromRegistry(context)` (line 165)

3. **Registered Providers**
   - **Echo360Provider**: `core/transcripts/providers/echo360Provider.ts` (line 341)
     - Implements `TranscriptProviderV2`
     - Sync detection for lesson pages
     - Async detection for section pages
   - **PanoptoProvider**: `core/transcripts/providers/panoptoProvider.ts` (line 152)
     - Implements `TranscriptProviderV2`
     - Sync detection only (DOM-based iframe scanning)

4. **Provider Selection**
   - **Current Implementation**: Direct detection in `detectVideosSync()` (videoDetection.ts)
   - **Registry Usage**: **NOT CURRENTLY USED** - detection bypasses registry
   - **Note**: Provider registry exists but detection uses direct function calls

### Transcript Data Model

1. **Core Types**
   - **File**: `core/transcripts/types.ts`
   - **DetectedVideo** (line 24-49):
     - `id: string`
     - `provider: VideoProvider`
     - `title: string`
     - `embedUrl: string`
     - `thumbnailUrl?: string`
     - `durationMs?: number`
     - `recordedAt?: string`
     - Echo360-specific: `echoOrigin`, `sectionId`, `lessonId`, `mediaId`
   - **TranscriptSegment** (line 73-82):
     - `startMs: number`
     - `endMs: number`
     - `text: string`
     - `speaker?: string`
   - **TranscriptResult** (line 87-94):
     - `plainText: string`
     - `segments: TranscriptSegment[]`
     - `durationMs?: number`
   - **TranscriptExtractionResult** (line 99-110):
     - `success: boolean`
     - `transcript?: TranscriptResult`
     - `error?: string`
     - `errorCode?: 'AUTH_REQUIRED' | 'NO_CAPTIONS' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'NOT_AVAILABLE'`
     - `aiTranscriptionAvailable?: boolean`

2. **VTT Parser**
   - **File**: `core/transcripts/webvttParser.ts`
   - **Function**: `parseWebVtt(vttContent: string): TranscriptResult` (line 109)
   - **Features**:
     - Parses WebVTT format with timestamps
     - Strips VTT formatting tags (`<v>`, `<c>`, `<b>`, etc.)
     - Decodes HTML entities (line 40-58)
     - Handles multi-line cue text
   - **Used by**: Panopto provider (line 235 in panoptoProvider.ts)

3. **Echo360 Transcript Parser**
   - **File**: `core/transcripts/providers/echo360Provider.ts`
   - **Function**: `parseEcho360Transcript(data: unknown)` (line 283)
   - **Parses**: JSON API response with `cues` array
   - **Converts**: Echo360 cue format → `TranscriptSegment[]`

### Network & Auth

1. **Background Script Fetch Helpers**
   - **File**: `extension/background.js`
   - **fetchWithRetry()** (line 139):
     - Exponential backoff retry logic
     - Max 2 retries (line 88)
     - Handles 401/403 as non-retryable (auth errors)
   - **fetchWithCredentials()** (line 182):
     - Wraps `fetchWithRetry()` with `credentials: "include"`
     - Accepts HTML content type
     - Throws `"AUTH_REQUIRED"` on 401/403
   - **fetchVttContent()** (line 202):
     - Similar to `fetchWithCredentials()` but accepts VTT content type
   - **Note**: No `fetchJson()` helper - uses `response.json()` directly

2. **AsyncFetcher Interface**
   - **File**: `core/transcripts/providerRegistry.ts`
   - **Interface**: `AsyncFetcher` (line 64-69)
     - `fetchWithCredentials(url: string): Promise<string>`
     - `fetchJson<T>(url: string): Promise<T>`
   - **Implementation**: **NOT FOUND** - Background script doesn't implement this interface
   - **Current**: Background script uses direct fetch calls, not through AsyncFetcher

3. **Background Message Handlers**
   - **EXTRACT_TRANSCRIPT** (line 1057 in background.js):
     - Calls `handleTranscriptExtraction(video)` (line 895)
     - Routes to provider-specific extractors:
       - `extractPanoptoTranscript()` (line 220)
       - `extractEcho360Transcript()` (line 723)
   - **FETCH_ECHO360_SYLLABUS** (line 1076):
     - Calls `fetchEcho360Syllabus(context)` (line 315)

4. **Auth Handling**
   - **Detection**: Returns `AUTH_REQUIRED` error code
   - **UI**: Shows `AuthRequiredPrompt` component (line 209 in VideoListPanel.tsx)
   - **Sign-in URL**: Extracted from `Echo360Context.echoOrigin`

### Storage / Caching

1. **Echo360 Syllabus Cache**
   - **Location**: `extension/background.js` (line 291)
   - **Type**: In-memory `Map<string, { data, timestamp }>`
   - **Key**: `${echoOrigin}:${sectionId}` (line 301)
   - **TTL**: 5 minutes (line 293)
   - **Invalidation**: Time-based only (no manual invalidation)

2. **Transcript Storage**
   - **Location**: **NOT FOUND** - No persistent storage for transcripts
   - **Current**: Transcripts stored only in React state (`lastTranscript` in useTranscripts.ts)
   - **Persistence**: Transcripts are lost on page refresh

3. **Session Storage**
   - **Location**: `extension/background.js` (line 914-982)
   - **Purpose**: Tab session management (chat history, etc.)
   - **Key Pattern**: `lockin_session_${tabId}`
   - **Note**: Does NOT store transcripts

---

## B) Symbol Index

| Symbol | File Path | Purpose |
|--------|-----------|---------|
| `LockInSidebar` | `ui/extension/LockInSidebar.tsx:218` | Main sidebar component with transcript button |
| `handleTranscriptClick` | `ui/extension/LockInSidebar.tsx:441` | Button click handler that triggers detection |
| `useTranscripts` | `ui/extension/transcripts/useTranscripts.ts:238` | React hook managing transcript state and operations |
| `detectAndAutoExtract` | `ui/extension/transcripts/useTranscripts.ts:459` | Main entry point: detects videos, auto-extracts if single video |
| `performDetection` | `ui/extension/transcripts/useTranscripts.ts:252` | Core detection logic shared by detect and auto-extract |
| `extractTranscript` | `ui/extension/transcripts/useTranscripts.ts:403` | Extract transcript for a specific video |
| `performExtraction` | `ui/extension/transcripts/useTranscripts.ts:366` | Sends EXTRACT_TRANSCRIPT message to background script |
| `sendToBackground` | `ui/extension/transcripts/useTranscripts.ts:193` | Helper to send messages to background script |
| `VideoListPanel` | `ui/extension/transcripts/VideoListPanel.tsx:177` | UI component showing list of detected videos |
| `TranscriptMessage` | `ui/extension/transcripts/TranscriptMessage.tsx:83` | UI component displaying extracted transcript |
| `detectVideosSync` | `core/transcripts/videoDetection.ts:232` | Synchronous video detection from page context |
| `VideoDetectionResult` | `core/transcripts/videoDetection.ts:216` | Return type from detectVideosSync |
| `VideoDetectionContext` | `core/transcripts/types.ts:54` | Input context for detection (pageUrl, iframes) |
| `collectIframeInfo` | `core/transcripts/videoDetection.ts:300` | Collects iframe information from document |
| `extractEcho360Context` | `core/transcripts/videoDetection.ts:67` | Extracts Echo360 context from URL |
| `getEcho360PageType` | `core/transcripts/videoDetection.ts:128` | Determines Echo360 page type (lesson/section/unknown) |
| `detectPanoptoVideosFromIframes` | `core/transcripts/videoDetection.ts:164` | Detects Panopto videos from iframe list |
| `TranscriptProviderV2` | `core/transcripts/providerRegistry.ts:22` | Provider interface with sync/async detection support |
| `ProviderRegistry` | `core/transcripts/providerRegistry.ts:78` | Registry class for managing providers |
| `registerProvider` | `core/transcripts/providerRegistry.ts:151` | Register a provider in the registry |
| `Echo360Provider` | `core/transcripts/providers/echo360Provider.ts:341` | Echo360 provider implementation |
| `PanoptoProvider` | `core/transcripts/providers/panoptoProvider.ts:152` | Panopto provider implementation |
| `DetectedVideo` | `core/transcripts/types.ts:24` | Type representing a detected video |
| `TranscriptResult` | `core/transcripts/types.ts:87` | Type representing parsed transcript |
| `TranscriptSegment` | `core/transcripts/types.ts:73` | Type representing a single transcript segment |
| `TranscriptExtractionResult` | `core/transcripts/types.ts:99` | Type representing extraction attempt result |
| `parseWebVtt` | `core/transcripts/webvttParser.ts:109` | Parses WebVTT content into TranscriptResult |
| `parseEcho360Transcript` | `core/transcripts/providers/echo360Provider.ts:283` | Parses Echo360 API response into TranscriptResult |
| `extractCaptionVttUrl` | `core/transcripts/providers/panoptoProvider.ts:110` | Extracts VTT URL from Panopto embed HTML |
| `handleTranscriptExtraction` | `extension/background.js:895` | Background script handler routing to provider extractors |
| `extractPanoptoTranscript` | `extension/background.js:220` | Background script Panopto extraction |
| `extractEcho360Transcript` | `extension/background.js:723` | Background script Echo360 extraction |
| `fetchEcho360Syllabus` | `extension/background.js:315` | Background script Echo360 syllabus fetcher |
| `fetchWithRetry` | `extension/background.js:139` | Fetch helper with exponential backoff retry |
| `fetchWithCredentials` | `extension/background.js:182` | Fetch helper with credentials included |
| `fetchVttContent` | `extension/background.js:202` | Fetch helper for VTT content |
| `syllabusCache` | `extension/background.js:291` | In-memory cache for Echo360 syllabus responses |
| `parseEcho360Syllabus` | `extension/background.js:414` | Parses Echo360 syllabus API response (background script version) |
| `parseEcho360Transcript` | `extension/background.js:834` | Parses Echo360 transcript API response (background script version) |
| `parseWebVtt` | `extension/background.js:33` | VTT parser (background script version, uses shared lib if available) |

---

## C) Extension Points for Adding HTML5 + AI Fallback

### 1. Detection Layer Extension

**Location**: `core/transcripts/videoDetection.ts`

**Current Flow**:
- `detectVideosSync()` checks Echo360 first, then Panopto, then returns empty

**Extension Point**:
- **After line 282** (after Panopto detection): Add HTML5 video detection
- **Function to add**: `detectHtml5Videos(context: VideoDetectionContext): DetectedVideo[]`
- **Implementation**:
  - Scan document for `<video>` elements
  - Extract `src`, `title`, `duration` attributes
  - Create `DetectedVideo` with `provider: 'unknown'` (or new `'html5'` provider type)
  - Return array of detected HTML5 videos

**Code Hook**:
```typescript
// In detectVideosSync(), after line 282:
const html5Videos = detectHtml5Videos(context);
if (html5Videos.length > 0) {
  return {
    videos: html5Videos,
    provider: 'html5', // or 'unknown'
    requiresApiCall: false,
  };
}
```

### 2. Provider Registration Extension

**Location**: `core/transcripts/providers/`

**New File**: `core/transcripts/providers/html5Provider.ts`

**Implementation**:
- Create `Html5Provider` class implementing `TranscriptProviderV2`
- `canHandle(url: string)`: Return `true` if page has `<video>` elements (or always true as fallback)
- `detectVideosSync()`: Scan DOM for `<video>` elements
- `requiresAsyncDetection()`: Return `false` (sync only)
- `extractTranscript()`: **Return AI fallback flag** - actual extraction handled separately

**Registration**: **NOT CURRENTLY USED** - Registry exists but detection bypasses it. Two options:
1. **Option A**: Modify `detectVideosSync()` to use registry (requires refactoring)
2. **Option B**: Add HTML5 detection directly in `detectVideosSync()` (simpler, matches current pattern)

### 3. Extraction Flow Extension

**Location**: `extension/background.js`

**Current Flow**:
- `handleTranscriptExtraction()` (line 895) routes to provider-specific extractors
- `extractPanoptoTranscript()` or `extractEcho360Transcript()`

**Extension Point**:
- **In `handleTranscriptExtraction()`** (line 896-910): Add HTML5 case
- **New Function**: `extractHtml5Transcript(video)` or `extractWithAIFallback(video)`
- **Logic**:
  1. Check if video has native captions (WebVTT tracks)
  2. If yes, extract and parse VTT
  3. If no, return `{ success: false, errorCode: 'NO_CAPTIONS', aiTranscriptionAvailable: true }`

**Code Hook**:
```javascript
case "html5":
case "unknown": {
  const result = await extractHtml5Transcript(video);
  return { success: result.success, data: result };
}
```

### 4. AI Transcription Fallback

**Location**: `extension/background.js` or new file

**Extension Point**:
- **In extraction handlers**: When `aiTranscriptionAvailable: true` is returned
- **UI Hook**: `ui/extension/transcripts/useTranscripts.ts` - `performExtraction()` (line 366)
- **Current**: Error message mentions AI fallback (line 382) but no actual trigger

**Implementation Options**:
1. **Option A**: Add "Use AI Transcription" button in `VideoListPanel` when `aiTranscriptionAvailable: true`
2. **Option B**: Auto-trigger AI transcription when native extraction fails
3. **Option C**: Add AI transcription option in `TranscriptMessage` component for failed extractions

**New Message Type**: `EXTRACT_TRANSCRIPT_AI` or `TRANSCRIBE_VIDEO_AI`
- Send video URL or blob to backend
- Backend calls transcription service (OpenAI Whisper, etc.)
- Return `TranscriptResult` in same format

### 5. Video Detection Context Extension

**Location**: `core/transcripts/videoDetection.ts`

**Current**: `collectIframeInfo()` only collects iframes

**Extension Point**:
- **New Function**: `collectVideoElements(doc: Document): Array<{ src, title, duration }>`
- **Implementation**: Query `document.querySelectorAll('video')`
- **Integration**: Add to `VideoDetectionContext` or call separately in `detectVideosSync()`

### 6. UI State Extension

**Location**: `ui/extension/transcripts/useTranscripts.ts`

**Current State**: `TranscriptState` (line 23-46)

**Extension Points**:
- **Add field**: `aiTranscriptionInProgress: boolean`
- **Add field**: `aiTranscriptionAvailable: boolean` (per video or global)
- **Modify**: `VideoListPanel` to show AI transcription option when available

### 7. Provider Type Extension

**Location**: `core/transcripts/types.ts`

**Current**: `VideoProvider = 'panopto' | 'echo360' | 'youtube' | 'unknown'`

**Extension**:
- Add `'html5'` to union type (line 15)
- Or use `'unknown'` for HTML5 videos (already exists)

### 8. Background Script Message Handler Extension

**Location**: `extension/background.js`

**Current**: `handleMessage()` (line 990) handles `EXTRACT_TRANSCRIPT` and `FETCH_ECHO360_SYLLABUS`

**Extension Point**:
- **Add case**: `TRANSCRIBE_VIDEO_AI` or `EXTRACT_TRANSCRIPT_AI`
- **Handler**: Calls backend API or local transcription service
- **Returns**: Same `TranscriptExtractionResult` format

### 9. Transcript Storage Extension (Future)

**Location**: **NOT FOUND** - No current storage

**Extension Point**:
- Add transcript caching in `chrome.storage.local`
- Key: `transcript_${video.provider}_${video.id}`
- Store `TranscriptResult` with timestamp
- Check cache before extraction

---

## Summary of Current Architecture

**Key Finding**: The provider registry (`ProviderRegistry`, `TranscriptProviderV2`) exists but is **NOT CURRENTLY USED**. Detection happens directly via function calls in `detectVideosSync()`, bypassing the registry pattern.

**Recommendation for HTML5 + AI**:
1. **Detection**: Add HTML5 detection directly in `detectVideosSync()` (matches current pattern)
2. **Extraction**: Add HTML5 case in `handleTranscriptExtraction()` in background script
3. **AI Fallback**: Add new message type `TRANSCRIBE_VIDEO_AI` and handler
4. **UI**: Extend `VideoListPanel` to show AI option when `aiTranscriptionAvailable: true`

**Missing Pieces**:
- No `AsyncFetcher` implementation (interface exists but unused)
- No transcript persistence/caching
- Provider registry exists but unused (could be refactored to use it)

