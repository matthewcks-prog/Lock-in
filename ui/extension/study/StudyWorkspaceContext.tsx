import type { DetectedVideo } from '@core/transcripts/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useVideoDetection } from '../transcripts/hooks/useVideoDetection';
import type { StudyToolId } from './studyToolRegistry';
import {
  closeStudyToolTab,
  focusStudyToolTab,
  INITIAL_STUDY_TABS_STATE,
  openStudyToolTab,
  type StudyTabsState,
} from './studyTabsState';

interface StudyWorkspaceContextValue {
  selectedVideoId: string | null;
  selectedVideo: DetectedVideo | null;
  videos: DetectedVideo[];
  isDetecting: boolean;
  detectionError: string | null;
  detectionHint: string | null;
  hasDetectedVideos: boolean;
  detectVideos: () => Promise<void>;
  selectVideo: (videoId: string | null) => void;
  openToolTabIds: StudyToolId[];
  activeToolId: StudyToolId | null;
  openToolTab: (toolId: StudyToolId) => void;
  focusToolTab: (toolId: StudyToolId) => void;
  closeToolTab: (toolId: StudyToolId) => void;
}

interface StudyVideoSelectionState {
  selectedVideoId: string | null;
  selectedVideo: DetectedVideo | null;
  selectVideo: (videoId: string | null) => void;
}

interface StudyVideoDetectionState {
  hasDetectedVideos: boolean;
  detectVideos: () => Promise<void>;
}

interface StudyToolTabsActions {
  tabsState: StudyTabsState;
  openToolTab: (toolId: StudyToolId) => void;
  focusToolTab: (toolId: StudyToolId) => void;
  closeToolTab: (toolId: StudyToolId) => void;
}

const StudyWorkspaceContext = createContext<StudyWorkspaceContextValue | null>(null);

function useStudyVideoSelection(videos: DetectedVideo[]): StudyVideoSelectionState {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? null,
    [selectedVideoId, videos],
  );

  useEffect(() => {
    if (selectedVideoId !== null && selectedVideo === null) {
      setSelectedVideoId(null);
    }
  }, [selectedVideo, selectedVideoId]);

  const selectVideo = useCallback(
    (videoId: string | null) => {
      if (videoId === null) {
        setSelectedVideoId(null);
        return;
      }
      const targetVideo = videos.find((video) => video.id === videoId);
      setSelectedVideoId(targetVideo?.id ?? null);
    },
    [videos],
  );

  return { selectedVideoId, selectedVideo, selectVideo };
}

function useStudyVideoDetectionState({
  detectVideosOnPage,
  setDetectionError,
}: {
  detectVideosOnPage: ReturnType<typeof useVideoDetection>['detectVideos'];
  setDetectionError: ReturnType<typeof useVideoDetection>['setError'];
}): StudyVideoDetectionState {
  const [hasDetectedVideos, setHasDetectedVideos] = useState(false);
  const detectVideos = useCallback(async () => {
    setHasDetectedVideos(true);
    try {
      await detectVideosOnPage();
    } catch (error) {
      setDetectionError(error instanceof Error ? error.message : 'Failed to detect videos');
    }
  }, [detectVideosOnPage, setDetectionError]);
  return { hasDetectedVideos, detectVideos };
}

function useStudyToolTabsState(): StudyToolTabsActions {
  const [tabsState, setTabsState] = useState<StudyTabsState>(INITIAL_STUDY_TABS_STATE);
  const openToolTab = useCallback((toolId: StudyToolId) => {
    setTabsState((state) => openStudyToolTab(state, toolId));
  }, []);
  const focusToolTab = useCallback((toolId: StudyToolId) => {
    setTabsState((state) => focusStudyToolTab(state, toolId));
  }, []);
  const closeToolTab = useCallback((toolId: StudyToolId) => {
    setTabsState((state) => closeStudyToolTab(state, toolId));
  }, []);
  return { tabsState, openToolTab, focusToolTab, closeToolTab };
}

export function StudyWorkspaceProvider({ children }: { children: ReactNode }): JSX.Element {
  const videoDetection = useVideoDetection();
  const videoSelection = useStudyVideoSelection(videoDetection.state.videos);
  const videoDetectionState = useStudyVideoDetectionState({
    detectVideosOnPage: videoDetection.detectVideos,
    setDetectionError: videoDetection.setError,
  });
  const toolTabs = useStudyToolTabsState();
  const { selectedVideoId, selectedVideo, selectVideo } = videoSelection;
  const { hasDetectedVideos, detectVideos } = videoDetectionState;
  const { tabsState, openToolTab, focusToolTab, closeToolTab } = toolTabs;
  const videoState = videoDetection.state;

  const value = useMemo<StudyWorkspaceContextValue>(
    () => ({
      selectedVideoId,
      selectedVideo,
      videos: videoState.videos,
      isDetecting: videoState.isDetecting,
      detectionError: videoState.error,
      detectionHint: videoState.detectionHint,
      hasDetectedVideos,
      detectVideos,
      selectVideo,
      openToolTabIds: tabsState.openToolIds,
      activeToolId: tabsState.activeToolId,
      openToolTab,
      focusToolTab,
      closeToolTab,
    }),
    [
      selectedVideoId,
      selectedVideo,
      videoState.videos,
      videoState.isDetecting,
      videoState.error,
      videoState.detectionHint,
      hasDetectedVideos,
      detectVideos,
      selectVideo,
      tabsState.openToolIds,
      tabsState.activeToolId,
      openToolTab,
      focusToolTab,
      closeToolTab,
    ],
  );

  return <StudyWorkspaceContext.Provider value={value}>{children}</StudyWorkspaceContext.Provider>;
}

export function useStudyWorkspace(): StudyWorkspaceContextValue {
  const context = useContext(StudyWorkspaceContext);
  if (context === null) {
    throw new Error('useStudyWorkspace must be used within a StudyWorkspaceProvider');
  }
  return context;
}
