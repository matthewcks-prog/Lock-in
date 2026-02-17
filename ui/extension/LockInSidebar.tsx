/**
 * LockInSidebar
 *
 * Main sidebar orchestrator for the Lock-in extension.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PageContext } from '../../core/domain/types';
import type { Note } from '../../core/domain/Note';
import type { ApiClient } from '../../api/client';
import { createNotesService } from '../../core/services/notesService.ts';
import { useNotesList } from '../hooks/useNotesList';
import { NotesPanel } from './notes/NotesPanel';
import { ToolProvider, useToolContext } from './tools';
import { NoteSaveProvider } from './contexts/NoteSaveContext';
import { TranscriptCacheProvider } from './contexts/TranscriptCacheContext';
import { ChatQueryProvider } from './chat';
import { FeedbackModal } from './feedback';
import { PrivacyNotice } from './sidebar/PrivacyNotice';
import { SidebarLayout } from './sidebar/SidebarLayout';
import { SidebarTabs } from './sidebar/SidebarTabs';
import { ChatSection } from './sidebar/ChatSection';
import { SidebarHeaderActions } from './sidebar/SidebarHeaderActions';
import { ToolSection } from './sidebar/ToolSection';
import { useResize } from './sidebar/useResize';
import {
  CHAT_TAB_ID,
  NOTES_TAB_ID,
  TOOL_TAB_ID,
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MAX_VW,
  SIDEBAR_DEFAULT_WIDTH,
} from './sidebar/constants';
import type { StorageAdapter } from './sidebar/types';
import { useSidebarState } from './sidebar/useSidebarState';
import type { NotesPanelHandlers, SidebarModel } from './sidebar/lockInSidebarTypes';

export interface LockInSidebarProps {
  apiClient: ApiClient | null;
  isOpen: boolean;
  onToggle: () => void;
  pendingPrefill?: string;
  onClearPrefill?: () => void;
  pageContext?: PageContext;
  storage?: StorageAdapter;
  activeTabExternal?: string;
}

function buildSidebarStateOptions({
  isOpen,
  onToggle,
  activeTabExternal,
  storage,
}: Pick<LockInSidebarProps, 'isOpen' | 'onToggle' | 'activeTabExternal' | 'storage'>): Parameters<
  typeof useSidebarState
>[0] {
  const options: Parameters<typeof useSidebarState>[0] = { isOpen, onToggle };
  if (activeTabExternal !== undefined && activeTabExternal.length > 0) {
    options.activeTabExternal = activeTabExternal;
  }
  if (storage !== undefined) {
    options.storage = storage;
  }
  return options;
}

function buildResizeOptions(storage?: StorageAdapter): Parameters<typeof useResize>[0] {
  const options: Parameters<typeof useResize>[0] = {
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    maxVw: SIDEBAR_MAX_VW,
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    storageKey: SIDEBAR_WIDTH_KEY,
  };
  if (storage !== undefined) {
    options.storage = storage;
  }
  return options;
}

function getPageContextValues(pageContext?: PageContext): {
  courseCode: string | null;
  currentWeek: number | null;
  pageUrl: string;
} {
  return {
    courseCode: pageContext?.courseContext.courseCode ?? null,
    currentWeek: pageContext?.courseContext?.week ?? null,
    pageUrl: pageContext?.url ?? (typeof window !== 'undefined' ? window.location.href : ''),
  };
}

function useSyncSidebarEffects({
  activeTab,
  activeToolId,
  refreshNotes,
  setActiveTab,
}: {
  activeTab: ReturnType<typeof useSidebarState>['activeTab'];
  activeToolId: string | null;
  refreshNotes: ReturnType<typeof useNotesList>['refresh'];
  setActiveTab: ReturnType<typeof useSidebarState>['setActiveTab'];
}): void {
  useEffect(() => {
    if (activeToolId !== null && activeToolId.length > 0) {
      setActiveTab(TOOL_TAB_ID);
    }
  }, [activeToolId, setActiveTab]);

  useEffect(() => {
    if (activeTab === NOTES_TAB_ID) {
      void refreshNotes();
    }
  }, [activeTab, refreshNotes]);
}

function useNotesPanelHandlers({
  deleteNoteFromList,
  refreshNotes,
  selectedNoteId,
  setSelectedNoteId,
  upsertNote,
}: {
  deleteNoteFromList: (noteId: string) => Promise<void>;
  refreshNotes: ReturnType<typeof useNotesList>['refresh'];
  selectedNoteId: string | null;
  setSelectedNoteId: ReturnType<typeof useSidebarState>['setSelectedNoteId'];
  upsertNote: ReturnType<typeof useNotesList>['upsertNote'];
}): NotesPanelHandlers {
  const onRefreshNotes = useCallback(() => {
    void refreshNotes();
  }, [refreshNotes]);

  const onNoteSaved = useCallback(
    (note: Note) => {
      upsertNote(note);
      setSelectedNoteId(note.id);
    },
    [setSelectedNoteId, upsertNote],
  );

  const onDeleteNote = useCallback(
    async (noteId: string) => {
      await deleteNoteFromList(noteId);
      if (selectedNoteId === noteId) setSelectedNoteId(null);
    },
    [deleteNoteFromList, selectedNoteId, setSelectedNoteId],
  );

  return { onDeleteNote, onNoteSaved, onRefreshNotes };
}

function useLockInSidebarModel(props: LockInSidebarProps): SidebarModel {
  const { activeToolId, activeToolTitle, closeTool } = useToolContext();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const sidebarState = useSidebarState(buildSidebarStateOptions(props));
  const notesService = useMemo(
    () => (props.apiClient !== null ? createNotesService(props.apiClient) : null),
    [props.apiClient],
  );
  const notesState = useNotesList({ notesService, limit: 50 });
  const { handleResizeStart } = useResize(buildResizeOptions(props.storage));
  const pageValues = getPageContextValues(props.pageContext);

  useSyncSidebarEffects({
    activeTab: sidebarState.activeTab,
    activeToolId,
    refreshNotes: notesState.refresh,
    setActiveTab: sidebarState.setActiveTab,
  });

  return {
    activeTab: sidebarState.activeTab,
    activeToolId,
    activeToolTitle,
    closeTool,
    courseCode: pageValues.courseCode,
    currentWeek: pageValues.currentWeek,
    deleteNoteFromList: notesState.deleteNote,
    handleResizeStart,
    handleTabChange: sidebarState.handleTabChange,
    isFeedbackOpen,
    notes: notesState.notes,
    notesLoading: notesState.isLoading,
    notesService,
    onClearPrefill: props.onClearPrefill,
    onToggle: props.onToggle,
    pageUrl: pageValues.pageUrl,
    pendingPrefill: props.pendingPrefill,
    refreshNotes: notesState.refresh,
    selectedNoteId: sidebarState.selectedNoteId,
    setActiveTab: sidebarState.setActiveTab,
    setIsFeedbackOpen,
    setIsNoteEditing: sidebarState.setIsNoteEditing,
    setSelectedNoteId: sidebarState.setSelectedNoteId,
    storage: props.storage,
    toggleNoteStar: notesState.toggleStar,
    upsertNote: notesState.upsertNote,
    isOpen: props.isOpen,
    apiClient: props.apiClient,
  };
}

function SidebarTabContent({
  model,
  notesHandlers,
}: {
  model: SidebarModel;
  notesHandlers: NotesPanelHandlers;
}): JSX.Element {
  return (
    <>
      {model.activeTab === CHAT_TAB_ID && (
        <ChatSection
          apiClient={model.apiClient}
          {...(model.storage !== undefined ? { storage: model.storage } : {})}
          pageUrl={model.pageUrl}
          courseCode={model.courseCode}
          {...(model.pendingPrefill !== undefined ? { pendingPrefill: model.pendingPrefill } : {})}
          {...(model.onClearPrefill !== undefined ? { onClearPrefill: model.onClearPrefill } : {})}
          isOpen={model.isOpen}
          isActive={model.activeTab === CHAT_TAB_ID}
        />
      )}
      {model.activeTab === NOTES_TAB_ID && (
        <NotesPanel
          notesService={model.notesService}
          notes={model.notes}
          notesLoading={model.notesLoading}
          onRefreshNotes={notesHandlers.onRefreshNotes}
          onNoteSaved={notesHandlers.onNoteSaved}
          onDeleteNote={notesHandlers.onDeleteNote}
          onToggleStar={model.toggleNoteStar}
          activeNoteId={model.selectedNoteId}
          onSelectNote={model.setSelectedNoteId}
          courseCode={model.courseCode}
          pageUrl={model.pageUrl}
          currentWeek={model.currentWeek}
          onNoteEditingChange={model.setIsNoteEditing}
        />
      )}
      {model.activeTab === TOOL_TAB_ID && (
        <ToolSection activeToolId={model.activeToolId} onClose={model.closeTool} />
      )}
      <PrivacyNotice />
    </>
  );
}

function SidebarFeedback({ model }: { model: SidebarModel }): JSX.Element {
  return (
    <FeedbackModal
      isOpen={model.isFeedbackOpen}
      onClose={() => model.setIsFeedbackOpen(false)}
      apiClient={model.apiClient}
      pageUrl={model.pageUrl}
      courseCode={model.courseCode}
    />
  );
}

function LockInSidebarView({ model }: { model: SidebarModel }): JSX.Element {
  const notesHandlers = useNotesPanelHandlers({
    deleteNoteFromList: model.deleteNoteFromList,
    refreshNotes: model.refreshNotes,
    selectedNoteId: model.selectedNoteId,
    setSelectedNoteId: model.setSelectedNoteId,
    upsertNote: model.upsertNote,
  });

  return (
    <TranscriptCacheProvider apiClient={model.apiClient}>
      <NoteSaveProvider
        notesService={model.notesService}
        pageUrl={model.pageUrl}
        courseCode={model.courseCode}
        upsertNote={model.upsertNote}
        setSelectedNoteId={model.setSelectedNoteId}
        setActiveTab={model.setActiveTab}
      >
        <SidebarLayout
          isOpen={model.isOpen}
          onToggle={model.onToggle}
          onResizeStart={model.handleResizeStart}
          headerLeft={
            <SidebarTabs
              activeTab={model.activeTab}
              onTabChange={model.handleTabChange}
              activeToolId={model.activeToolId}
              activeToolTitle={model.activeToolTitle}
              onCloseTool={model.closeTool}
            />
          }
          headerRight={
            <SidebarHeaderActions onOpenFeedback={() => model.setIsFeedbackOpen(true)} />
          }
        >
          <SidebarTabContent model={model} notesHandlers={notesHandlers} />
        </SidebarLayout>
        <SidebarFeedback model={model} />
      </NoteSaveProvider>
    </TranscriptCacheProvider>
  );
}

function LockInSidebarContent(props: LockInSidebarProps): JSX.Element {
  const model = useLockInSidebarModel(props);
  return <LockInSidebarView model={model} />;
}

export function LockInSidebar(props: LockInSidebarProps): JSX.Element {
  return (
    <ToolProvider>
      <ChatQueryProvider>
        <LockInSidebarContent {...props} />
      </ChatQueryProvider>
    </ToolProvider>
  );
}
