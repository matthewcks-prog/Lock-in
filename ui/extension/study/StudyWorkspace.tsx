import type { DetectedVideo } from '@core/transcripts/types';
import { ChevronDown } from 'lucide-react';
import { useEffect } from 'react';
import { VideoListPanel } from '../videos';
import { ToolPanelLayout, type ToolPanelTab } from './ToolPanelLayout';
import { StudyToolsMenu } from './StudyToolsMenu';
import { useStudyWorkspace } from './StudyWorkspaceContext';
import { STUDY_TOOL_REGISTRY, type StudyToolId } from './studyToolRegistry';

function StudyHeader(): JSX.Element {
  const { selectedVideoId, selectedVideo, videos, selectVideo } = useStudyWorkspace();

  return (
    <div className="lockin-study-header lockin-tab-toolbar">
      <div className="lockin-study-video-control lockin-tab-toolbar-start">
        {selectedVideo !== null ? (
          <>
            <label htmlFor="lockin-study-video-selector" className="lockin-study-video-label">
              Current video
            </label>
            <div className="lockin-study-video-select-shell">
              <select
                id="lockin-study-video-selector"
                className="lockin-study-video-select"
                value={selectedVideoId ?? ''}
                onChange={(event) => selectVideo(event.target.value)}
              >
                {videos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="lockin-study-video-select-chevron"
                size={12}
                strokeWidth={2}
              />
            </div>
          </>
        ) : (
          <span className="lockin-study-video-placeholder">Select a video to begin studying</span>
        )}
      </div>
      <div className="lockin-study-header-actions lockin-tab-toolbar-end">
        <StudyToolsMenu />
      </div>
    </div>
  );
}

function StudySelectionView({
  isDetecting,
  videos,
  detectionError,
  detectionHint,
  onSelectVideo,
}: {
  isDetecting: boolean;
  videos: DetectedVideo[];
  detectionError: string | null;
  detectionHint: string | null;
  onSelectVideo: (video: DetectedVideo) => void;
}): JSX.Element {
  return (
    <VideoListPanel
      videos={videos}
      isLoading={isDetecting}
      onSelectVideo={onSelectVideo}
      {...(detectionError !== null ? { error: detectionError } : {})}
      {...(detectionHint !== null ? { detectionHint } : {})}
      title="Select a video"
    />
  );
}

function StudyToolViews(): JSX.Element {
  const { openToolTabIds, activeToolId, focusToolTab, closeToolTab } = useStudyWorkspace();

  const tabs: ToolPanelTab<StudyToolId>[] = openToolTabIds.map((toolId) => {
    const tool = STUDY_TOOL_REGISTRY[toolId];
    return {
      id: tool.id,
      title: tool.label,
      closeable: tool.closeable !== false,
    };
  });

  return (
    <ToolPanelLayout
      ariaLabel="Study tools tabs"
      idPrefix="lockin-study-tool"
      tabs={tabs}
      activeTabId={activeToolId}
      onActivateTab={focusToolTab}
      onCloseTab={closeToolTab}
      emptyState={<div className="lockin-study-tool-empty">Open a study tool to continue.</div>}
      renderContent={(toolId) => {
        const ToolComponent = STUDY_TOOL_REGISTRY[toolId].component;
        return <ToolComponent />;
      }}
    />
  );
}

export function StudyWorkspace(): JSX.Element {
  const {
    hasDetectedVideos,
    detectVideos,
    selectedVideo,
    videos,
    isDetecting,
    detectionError,
    detectionHint,
    selectVideo,
    openToolTab,
  } = useStudyWorkspace();

  useEffect(() => {
    if (hasDetectedVideos) return;
    void detectVideos();
  }, [detectVideos, hasDetectedVideos]);

  return (
    <section className="lockin-study-workspace">
      <StudyHeader />
      <div className={`lockin-study-body${selectedVideo === null ? ' is-selection' : ''}`}>
        {selectedVideo === null ? (
          <div className="lockin-study-selection-shell">
            <StudySelectionView
              isDetecting={isDetecting}
              videos={videos}
              detectionError={detectionError}
              detectionHint={detectionHint}
              onSelectVideo={(video) => {
                selectVideo(video.id);
                openToolTab('transcript');
              }}
            />
          </div>
        ) : (
          <StudyToolViews />
        )}
      </div>
    </section>
  );
}
