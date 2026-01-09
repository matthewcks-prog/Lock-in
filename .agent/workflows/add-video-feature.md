---
description: How to add a new video-based feature (e.g., Key Takeaways, Quiz Me)
---

# Adding a New Video-Based Feature

When adding a feature that needs video detection and selection (like "Key Takeaways" or "Quiz Me"), follow this pattern.

## ✅ DO: Use the Generic Video Components

The generic video components in `ui/extension/videos/` handle all shared concerns:

```typescript
import { VideoListPanel } from '../../videos';
import type { DetectedVideo } from '@core/transcripts/types';

function MyFeatureVideoListPanel({
  videos,
  isLoading,
  onSelectVideo,
  onClose,
  error,
  // Your feature-specific state:
  myFeatureState,
  onMyFeatureAction,
}) {
  return (
    <VideoListPanel
      videos={videos}
      isLoading={isLoading}
      onSelectVideo={onSelectVideo}
      onClose={onClose}
      error={error}
      
      // Customize title and empty message
      title="Select a video for my feature"
      emptyMessage="No videos found on this page."
      
      // Inject feature-specific badges
      renderItemBadge={({ video }) => 
        hasMyFeatureData(video) && <span className="badge">Ready</span>
      }
      
      // Inject feature-specific actions below each item
      renderItemActions={({ video }) => (
        <MyFeatureActions 
          video={video}
          state={myFeatureState}
          onAction={onMyFeatureAction}
        />
      )}
      
      // Control which videos are disabled
      isVideoDisabled={(video) => myFeatureState.isBusy}
    />
  );
}
```

## ✅ DO: Reuse useVideoDetection Hook

Video detection logic is already generic:

```typescript
import { useVideoDetection } from '../transcripts/hooks';

function useMyFeature() {
  const detection = useVideoDetection();
  // detection.detectVideos() returns { videos, provider }
  // detection.state has { videos, isDetecting, error, detectionHint }
  
  // Add your feature-specific logic here
  const [myState, setMyState] = useState(...);
  
  return {
    ...detection,
    myState,
    // ...
  };
}
```

## ❌ DON'T: Add Feature-Specific Props to Generic Components

**Wrong** - This couples the generic component to one specific feature:

```typescript
// ❌ BAD: Adding transcript-specific props to VideoListPanel
interface VideoListPanelProps {
  videos: DetectedVideo[];
  isLoading: boolean;
  // ... generic props ...
  
  // ❌ These are transcript-specific, don't add here!
  isExtracting: boolean;
  extractingVideoId: string | null;
  aiTranscription: AiTranscriptionState;
  onTranscribeWithAI: (video: DetectedVideo) => void;
}
```

**Right** - Use render props to inject feature-specific UI:

```typescript
// ✅ GOOD: Feature-specific wrapper using render props
<VideoListPanel
  videos={videos}
  isLoading={isLoading}
  renderItemBadge={({ video }) => <MyBadge video={video} />}
  renderItemActions={({ video }) => <MyActions video={video} />}
/>
```

## ❌ DON'T: Duplicate Loading/Empty/Error State UI

The generic `VideoListPanel` already handles:
- Loading spinner with "Detecting videos..." message
- Empty state with customizable message
- Error display
- Auth-required prompt for providers needing sign-in

Don't recreate these. Just wrap `VideoListPanel` and customize via props.

## ❌ DON'T: Put Feature Logic in Generic Components

**Wrong** - Generic components should not know about transcripts, AI, etc.:

```typescript
// ❌ BAD: isAiTranscriptionBusy in generic VideoListItem
function VideoListItem({ video, aiTranscription }) {
  const isAiBusy = isAiTranscriptionBusy(aiTranscription.status); // ❌
}
```

**Right** - Keep feature logic in feature-specific components:

```typescript
// ✅ GOOD: Feature logic in TranscriptVideoStatus
function TranscriptVideoStatus({ video, aiTranscription }) {
  const isAiBusy = isAiTranscriptionBusy(aiTranscription.status); // ✅
  // Render transcript-specific UI...
}
```

## File Structure for New Features

```
ui/extension/
├── videos/                          # ✅ REUSE - Don't modify
│   ├── VideoListPanel.tsx
│   ├── VideoListItem.tsx
│   ├── ProviderBadge.tsx
│   └── types.ts
│
├── transcripts/                     # Existing feature - reference pattern
│   ├── components/
│   │   ├── TranscriptVideoListPanel.tsx
│   │   └── TranscriptVideoStatus.tsx
│   └── hooks/
│       └── useVideoDetection.ts     # ✅ REUSE
│
└── myNewFeature/                    # 🆕 Your new feature
    ├── components/
    │   ├── MyFeatureVideoListPanel.tsx  # Wraps VideoListPanel
    │   └── MyFeatureActions.tsx         # Feature-specific actions
    └── hooks/
        └── useMyFeature.ts              # Uses useVideoDetection
```

## Render Props Available

| Prop | Purpose | Example Use |
|------|---------|-------------|
| `renderItemBadge` | Badge after video title | "No transcript", "Ready", "Processing" |
| `renderItemActions` | Actions below video item | AI transcription button, progress bar |
| `renderItemStatus` | Status icon in action area | Custom spinner, checkmark, error icon |

## When to Modify Generic Components

Only modify `ui/extension/videos/` components if:
1. You're adding a **new render prop** that multiple features need
2. You're fixing a **bug** in shared behavior
3. You're adding a **new customization point** (not feature logic)

Never add feature-specific state or logic to generic components.
