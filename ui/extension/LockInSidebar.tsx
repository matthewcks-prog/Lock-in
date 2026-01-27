/**
 * LockInSidebar
 *
 * Main sidebar orchestrator for the Lock-in extension.
 */
import { useEffect, useMemo, useState } from 'react';
import type { PageContext, StudyMode } from '../../core/domain/types';
import type { ApiClient } from '../../api/client';
import { createNotesService } from '../../core/services/notesService.ts';
import type { NotesService } from '../../core/services/notesService.ts';
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
} from './sidebar/constants';
import type { StorageAdapter } from './sidebar/types';
import { useSidebarState } from './sidebar/useSidebarState';
export interface LockInSidebarProps {
  apiClient: ApiClient | null;
  isOpen: boolean;
  onToggle: () => void;
  currentMode: StudyMode;
  pendingPrefill?: string;
  onClearPrefill?: () => void;
  pageContext?: PageContext;
  adapter?: any;
  storage?: StorageAdapter;
  activeTabExternal?: string;
}
function LockInSidebarContent({
  apiClient,
  isOpen,
  onToggle,
  currentMode,
  pendingPrefill,
  onClearPrefill,
  pageContext,
  storage,
  activeTabExternal,
}: LockInSidebarProps) {
  const { activeToolId, activeToolTitle, closeTool } = useToolContext();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const {
    activeTab,
    setActiveTab,
    handleTabChange,
    mode,
    selectedNoteId,
    setSelectedNoteId,
    setIsNoteEditing,
  } = useSidebarState({
    activeTabExternal,
    currentMode,
    storage,
    isOpen,
    onToggle,
  });

  const notesService: NotesService | null = useMemo(
    () => (apiClient ? createNotesService(apiClient) : null),
    [apiClient],
  );

  const {
    notes,
    isLoading: notesLoading,
    refresh: refreshNotes,
    upsertNote,
    deleteNote: deleteNoteFromList,
    toggleStar: toggleNoteStar,
  } = useNotesList({
    notesService,
    limit: 50,
  });

  const { handleResizeStart } = useResize({
    storage,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    maxVw: SIDEBAR_MAX_VW,
    storageKey: SIDEBAR_WIDTH_KEY,
  });

  const courseCode = pageContext?.courseContext.courseCode || null;
  const pageUrl = pageContext?.url || (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    if (activeToolId) {
      setActiveTab(TOOL_TAB_ID);
    }
  }, [activeToolId, setActiveTab]);

  useEffect(() => {
    if (activeTab === NOTES_TAB_ID) {
      refreshNotes();
    }
  }, [activeTab, refreshNotes]);

  return (
    <TranscriptCacheProvider apiClient={apiClient}>
      <NoteSaveProvider
        notesService={notesService}
        pageUrl={pageUrl}
        courseCode={courseCode}
        upsertNote={upsertNote}
        setSelectedNoteId={setSelectedNoteId}
        setActiveTab={setActiveTab}
      >
        <SidebarLayout
          isOpen={isOpen}
          onToggle={onToggle}
          onResizeStart={handleResizeStart}
          headerLeft={
            <SidebarTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              activeToolId={activeToolId}
              activeToolTitle={activeToolTitle}
              onCloseTool={closeTool}
            />
          }
          headerRight={<SidebarHeaderActions onOpenFeedback={() => setIsFeedbackOpen(true)} />}
        >
          {activeTab === CHAT_TAB_ID && (
            <ChatSection
              apiClient={apiClient}
              storage={storage}
              mode={mode}
              pageUrl={pageUrl}
              courseCode={courseCode}
              pendingPrefill={pendingPrefill}
              onClearPrefill={onClearPrefill}
              isOpen={isOpen}
              isActive={activeTab === CHAT_TAB_ID}
            />
          )}

          {activeTab === NOTES_TAB_ID && (
            <NotesPanel
              notesService={notesService}
              notes={notes}
              notesLoading={notesLoading}
              onRefreshNotes={refreshNotes}
              onNoteSaved={(note) => {
                upsertNote(note);
                setSelectedNoteId(note.id);
              }}
              onDeleteNote={async (noteId) => {
                await deleteNoteFromList(noteId);
                if (selectedNoteId === noteId) {
                  setSelectedNoteId(null);
                }
              }}
              onToggleStar={toggleNoteStar}
              activeNoteId={selectedNoteId}
              onSelectNote={(noteId) => setSelectedNoteId(noteId)}
              courseCode={courseCode}
              pageUrl={pageUrl}
              currentWeek={pageContext?.courseContext?.week}
              onNoteEditingChange={setIsNoteEditing}
            />
          )}

          {activeTab === TOOL_TAB_ID && (
            <ToolSection activeToolId={activeToolId} onClose={closeTool} />
          )}

          {/* Privacy disclosure notice - shown on first use */}
          <PrivacyNotice />
        </SidebarLayout>

        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          apiClient={apiClient}
          pageUrl={pageUrl}
          courseCode={courseCode}
        />
      </NoteSaveProvider>
    </TranscriptCacheProvider>
  );
}

export function LockInSidebar(props: LockInSidebarProps) {
  return (
    <ToolProvider>
      <ChatQueryProvider>
        <LockInSidebarContent {...props} />
      </ChatQueryProvider>
    </ToolProvider>
  );
}
