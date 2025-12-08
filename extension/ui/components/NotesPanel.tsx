/**
 * Notes Panel Component
 *
 * Displays notes editor and notes list.
 * Uses useNotes hook for state management.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNotes } from "../hooks/useNotes";
import type { ApiClient } from "@api/client";
import { escapeHtml } from "@core/utils/textUtils";

export interface NotesPanelProps {
  apiClient: ApiClient;
  courseCode?: string | null;
  sourceUrl?: string;
}

export function NotesPanel({
  apiClient,
  courseCode,
  sourceUrl,
}: NotesPanelProps) {
  const {
    activeNote,
    setActiveNote,
    notes,
    isLoading,
    error,
    viewMode,
    setViewMode,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    createNote,
    saveNote,
    deleteNote,
    duplicateNote,
    saveStatus,
    hasChanges,
  } = useNotes({ apiClient, courseCode, sourceUrl });

  const noteEditorRef = useRef<HTMLDivElement>(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);

  // Initialize editor content
  useEffect(() => {
    if (noteEditorRef.current && viewMode === "current") {
      noteEditorRef.current.innerHTML = activeNote.content || "";
    }
  }, [activeNote.id, viewMode]);

  // Auto-save on content change
  useEffect(() => {
    if (!hasChanges || !activeNote.content.trim()) return;

    const saveTimer = setTimeout(async () => {
      setIsNoteSaving(true);
      await saveNote();
      setIsNoteSaving(false);
    }, 2000); // Debounce 2 seconds

    return () => clearTimeout(saveTimer);
  }, [activeNote.content, hasChanges, saveNote]);

  const handleEditorInput = () => {
    if (!noteEditorRef.current) return;
    setActiveNote({
      ...activeNote,
      content: noteEditorRef.current.innerHTML,
    });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveNote({ ...activeNote, title: e.target.value });
  };

  const handleToolbarClick = (command: string) => {
    document.execCommand(command, false);
    noteEditorRef.current?.focus();
  };

  const getNotesCourseLabel = () => {
    if (courseCode) return courseCode;
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        return url.hostname;
      } catch {
        return "Unknown";
      }
    }
    return "All notes";
  };

  const filteredNotes = notes.filter((note) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="lockin-notes-shell">
      <div className="lockin-notes-header">
        <div className="lockin-notes-heading">
          <div className="lockin-notes-heading-title">Notes</div>
          <div className="lockin-notes-heading-subtitle">
            {escapeHtml(getNotesCourseLabel())}
          </div>
        </div>
        <div
          className="lockin-notes-toggle"
          role="group"
          aria-label="Notes view"
        >
          <button
            className={`lockin-notes-toggle-btn ${
              viewMode === "current" ? "is-active" : ""
            }`}
            onClick={() => setViewMode("current")}
            aria-pressed={viewMode === "current"}
          >
            Current
          </button>
          <button
            className={`lockin-notes-toggle-btn ${
              viewMode === "all" ? "is-active" : ""
            }`}
            onClick={() => setViewMode("all")}
            aria-pressed={viewMode === "all"}
          >
            All notes
          </button>
        </div>
        <div className="lockin-notes-actions">
          <button
            className="lockin-btn-primary lockin-new-note-btn"
            onClick={createNote}
            title="Create a new note"
          >
            + New note
          </button>
        </div>
      </div>

      <div className="lockin-notes-body">
        {viewMode === "current" && (
          <div className="lockin-note-current-view is-active">
            <div className="lockin-note-meta-row">
              <div className="lockin-note-link">
                <span className="lockin-note-link-label">Linked to:</span>
                <span className="lockin-note-link-target">
                  {activeNote.sourceUrl ? (
                    <a
                      href={activeNote.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {activeNote.linkedLabel || activeNote.sourceUrl}
                    </a>
                  ) : (
                    <span className="lockin-note-link-empty">None</span>
                  )}
                </span>
              </div>
              <div className="lockin-note-stamps">{saveStatus}</div>
            </div>

            <div className="lockin-note-title-wrap">
              <input
                className="lockin-note-title-input"
                placeholder="Note title..."
                value={activeNote.title || ""}
                onChange={handleTitleChange}
              />
            </div>

            <div className="lockin-note-toolbar">
              <div className="lockin-note-toolbar-left">
                <button
                  className="lockin-note-tool-btn"
                  onClick={() => handleToolbarClick("bold")}
                  title="Bold (Ctrl/Cmd+B)"
                >
                  B
                </button>
                <button
                  className="lockin-note-tool-btn"
                  onClick={() => handleToolbarClick("italic")}
                  title="Italic (Ctrl/Cmd+I)"
                >
                  I
                </button>
                <button
                  className="lockin-note-tool-btn"
                  onClick={() => handleToolbarClick("underline")}
                  title="Underline (Ctrl/Cmd+U)"
                >
                  U
                </button>
                <span className="lockin-note-toolbar-divider"></span>
                <button
                  className="lockin-note-tool-btn"
                  onClick={() => handleToolbarClick("insertUnorderedList")}
                  title="Bulleted list"
                >
                  •
                </button>
                <button
                  className="lockin-note-tool-btn"
                  onClick={() => handleToolbarClick("insertOrderedList")}
                  title="Numbered list"
                >
                  1.
                </button>
              </div>
              <div className="lockin-note-toolbar-right">
                <button
                  className="lockin-note-menu-trigger"
                  aria-haspopup="true"
                  title="More options"
                >
                  ⋯
                </button>
                <div className="lockin-note-menu" role="menu">
                  <button
                    type="button"
                    onClick={() =>
                      activeNote.id && duplicateNote(activeNote.id)
                    }
                  >
                    Duplicate note
                  </button>
                  <button
                    type="button"
                    onClick={() => activeNote.id && deleteNote(activeNote.id)}
                    className="danger"
                  >
                    Delete note
                  </button>
                </div>
              </div>
            </div>

            <div className="lockin-note-editor-card">
              <div
                ref={noteEditorRef}
                className="lockin-note-editor"
                contentEditable
                data-placeholder="Write your note here. Add details, context, and your own thoughts…"
                onInput={handleEditorInput}
              />
            </div>

            <div className="lockin-note-footer-status">
              <span className="lockin-note-status-text">
                {isNoteSaving ? "Saving..." : saveStatus}
              </span>
            </div>
          </div>
        )}

        {viewMode === "all" && (
          <div className="lockin-all-notes-view is-active">
            <div className="lockin-notes-filter-bar">
              <div className="lockin-notes-filter-left">
                <span className="lockin-filter-label">Showing:</span>
                <select
                  className="lockin-notes-filter-select"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                >
                  <option value="page">This page</option>
                  <option value="course">This course</option>
                  <option value="all">All notes</option>
                  <option value="starred">Starred</option>
                </select>
              </div>
              <div className="lockin-notes-search">
                <input
                  className="lockin-notes-search-input"
                  placeholder="Search notes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="lockin-notes-list">
              {isLoading && <p className="lockin-empty">Loading...</p>}
              {error && (
                <p className="lockin-empty">
                  Failed to load notes. Please try again.
                </p>
              )}
              {!isLoading && !error && filteredNotes.length === 0 && (
                <div className="lockin-notes-empty">
                  <div className="lockin-notes-empty-title">No notes yet.</div>
                  <div className="lockin-notes-empty-subtitle">
                    Create one with + New note or save from Chat.
                  </div>
                </div>
              )}
              {filteredNotes.map((note) => (
                <div
                  key={note.id || `temp-${note.title}`}
                  className="lockin-note-card"
                  onClick={() => setActiveNote(note)}
                >
                  <div className="lockin-note-card-title">
                    {note.title || "Untitled"}
                  </div>
                  <div className="lockin-note-card-preview">
                    {note.content.replace(/<[^>]*>/g, "").substring(0, 100)}
                  </div>
                  <div className="lockin-note-card-meta">
                    {note.courseCode && (
                      <span className="lockin-note-card-course">
                        {note.courseCode}
                      </span>
                    )}
                    {note.updatedAt && (
                      <span className="lockin-note-card-time">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
