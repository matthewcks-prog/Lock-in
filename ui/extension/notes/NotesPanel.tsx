import { useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "../../../core/domain/Note.ts";
import type { NotesService } from "../../../core/services/notesService.ts";
import { useNoteAssets } from "../../hooks/useNoteAssets";
import { useNoteEditor } from "../../hooks/useNoteEditor";
import { NoteEditor } from "./NoteEditor";

interface NotesPanelProps {
  notesService: NotesService | null | undefined;
  notes: Note[];
  notesLoading: boolean;
  onRefreshNotes: () => void;
  onNoteSaved: (note: Note) => void;
  activeNoteId: string | null;
  onSelectNote: (noteId: string | null) => void;
  courseCode: string | null;
  pageUrl: string;
  currentWeek?: number | null;
  onNoteEditingChange?: (editing: boolean) => void;
}

function relativeLabel(iso: string | null | undefined) {
  if (!iso) return "just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatLinkedLabel(week: number | null | undefined): string | null {
  if (week != null && week > 0) {
    return `Week ${week}`;
  }
  return null;
}

export function NotesPanel({
  notesService,
  notes,
  notesLoading,
  onRefreshNotes,
  onNoteSaved,
  activeNoteId,
  onSelectNote,
  courseCode,
  pageUrl,
  currentWeek,
  onNoteEditingChange,
}: NotesPanelProps) {
  const [view, setView] = useState<"current" | "all">("current");
  const [filter, setFilter] = useState<"page" | "course" | "all" | "starred">(
    "course"
  );
  const [search, setSearch] = useState("");

  // Only store sourceUrl when we have a valid week number
  // This ensures we only link notes when we're 100% sure about the source
  const hasValidWeek = currentWeek != null && currentWeek > 0;
  const effectiveSourceUrl = hasValidWeek ? pageUrl : null;

  const {
    note,
    status,
    error: editorError,
    activeNoteId: editorActiveId,
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
  } = useNoteEditor({
    noteId: activeNoteId,
    notesService,
    defaultCourseCode: courseCode,
    defaultSourceUrl: effectiveSourceUrl,
  });

  // Sync editor's activeNoteId back to parent only when it changes due to save (new note gets ID)
  // Use a ref to track the previous value and avoid loops
  const prevEditorActiveIdRef = useRef(editorActiveId);
  useEffect(() => {
    // Only notify parent if editorActiveId changed AND it's different from what parent passed in
    // This handles the case where a new note is saved and gets an ID
    if (
      editorActiveId !== prevEditorActiveIdRef.current &&
      editorActiveId !== activeNoteId &&
      editorActiveId !== null
    ) {
      onSelectNote(editorActiveId);
    }
    prevEditorActiveIdRef.current = editorActiveId;
  }, [editorActiveId, activeNoteId, onSelectNote]);

  useEffect(() => {
    if (status === "saved" && note) {
      onNoteSaved(note);
    }
  }, [note, onNoteSaved, status]);

  useEffect(() => {
    // Keep the "editing" signal alive briefly after a save to avoid
    // collapsing the sidebar mid-autosave.
    const isEditing = status === "editing" || status === "saving";
    if (isEditing) {
      onNoteEditingChange?.(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      onNoteEditingChange?.(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [onNoteEditingChange, status]);

  const {
    isUploading: isAssetUploading,
    error: noteAssetError,
    uploadAsset,
    deleteAsset,
  } = useNoteAssets(editorActiveId, notesService);

  const filteredNotes = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return notes.filter((item) => {
      // Filter logic
      let matchesFilter = false;
      
      if (filter === "all") {
        matchesFilter = true;
      } else if (filter === "course") {
        // Match notes with the same course code, handling null cases
        if (courseCode != null) {
          matchesFilter = item.courseCode === courseCode;
        } else {
          // If no course code in context, show notes without a course code
          matchesFilter = item.courseCode == null;
        }
      } else if (filter === "page") {
        // Match notes from the same page URL
        if (pageUrl) {
          matchesFilter = item.sourceUrl === pageUrl;
        } else {
          // If no page URL, show notes without a source URL
          matchesFilter = item.sourceUrl == null;
        }
      } else if (filter === "starred") {
        // Only show notes that are explicitly starred (isStarred === true)
        matchesFilter = item.isStarred === true;
      }
      
      // Search logic
      const preview = item.previewText || item.content?.plainText || "";
      const matchesSearch =
        !searchTerm ||
        item.title.toLowerCase().includes(searchTerm) ||
        preview.toLowerCase().includes(searchTerm);
      
      return matchesFilter && matchesSearch;
    });
  }, [courseCode, filter, notes, pageUrl, search]);

  const handleNewNote = () => {
    resetToNew();
    onSelectNote(null);
    setView("current");
  };

  const handleSelectNote = (noteId: string | null) => {
    onSelectNote(noteId);
    setView("current");
  };

  // Only show linked section and store sourceUrl when we have a valid week
  const weekLabel = formatLinkedLabel(currentWeek);
  const linkedTarget = weekLabel ? note?.sourceUrl || pageUrl : null;

  return (
    <div className="lockin-notes-panel">
      {/* Header: Left (Course + Week), Middle (toggle), Right (button) */}
      <header className="lockin-notes-header lockin-notes-header-row">
        <div className="lockin-notes-header-left">
          <div className="lockin-notes-course-row">
            <span className="lockin-notes-label">Course:</span>
            <strong className="lockin-notes-course-value">
              {courseCode || "None"}
            </strong>
          </div>
          {weekLabel && (
            <div className="lockin-notes-link-row">
              <span className="lockin-notes-label">Linked to:</span>
              <a
                href={linkedTarget || "#"}
                target="_blank"
                rel="noreferrer"
                className="lockin-notes-link-href"
              >
                {weekLabel}
              </a>
            </div>
          )}
        </div>

        <div className="lockin-notes-header-center">
          <div className="lockin-notes-toggle">
            <button
              type="button"
              className={`lockin-notes-toggle-btn${
                view === "current" ? " is-active" : ""
              }`}
              onClick={() => setView("current")}
            >
              Current
            </button>
            <button
              type="button"
              className={`lockin-notes-toggle-btn${
                view === "all" ? " is-active" : ""
              }`}
              onClick={() => setView("all")}
            >
              All notes
            </button>
          </div>
        </div>

        <div className="lockin-notes-header-right">
          <button
            type="button"
            className="lockin-btn-primary"
            onClick={handleNewNote}
          >
            + New note
          </button>
        </div>
      </header>

      {/* Body: Editor or Notes List */}
      <div className="lockin-notes-body">
        {view === "current" && (
          <NoteEditor
            note={note}
            status={status}
            title={note?.title || ""}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
            onSaveNow={saveNow}
            onUploadFile={uploadAsset}
            onDeleteAsset={deleteAsset}
            isAssetUploading={isAssetUploading}
            assetError={noteAssetError}
            editorError={editorError}
          />
        )}

        {view === "all" && (
          <div className="lockin-notes-list-container">
            <div className="lockin-notes-filter-bar">
              <div className="lockin-notes-filter-group">
                <span className="lockin-notes-filter-label">Filter</span>
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
              <input
                type="text"
                className="lockin-notes-search-input"
                placeholder="Search notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="lockin-btn-ghost"
                onClick={onRefreshNotes}
              >
                Refresh
              </button>
            </div>

            <div className="lockin-notes-list">
              {notesLoading ? (
                <div className="lockin-notes-empty">Loading notes...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="lockin-notes-empty">
                  <div className="lockin-notes-empty-title">No notes yet</div>
                  <div className="lockin-notes-empty-subtitle">
                    Capture a note from the current page to see it here.
                  </div>
                  <button
                    type="button"
                    className="lockin-btn-ghost lockin-notes-empty-btn"
                    onClick={() => setView("current")}
                  >
                    Create a note
                  </button>
                </div>
              ) : (
                filteredNotes.map((item) => (
                  <div
                    key={item.id || item.title}
                    className={`lockin-note-card${
                      item.id && item.id === editorActiveId ? " is-active" : ""
                    }`}
                    onClick={() => handleSelectNote(item.id || null)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleSelectNote(item.id || null);
                      }
                    }}
                  >
                    <div className="lockin-note-card-header">
                      <div className="lockin-note-card-title">
                        {item.title || "Untitled"}
                      </div>
                      {item.courseCode && (
                        <span className="lockin-note-badge">
                          {item.courseCode}
                        </span>
                      )}
                    </div>
                    <div className="lockin-note-card-snippet">
                      {item.previewText ||
                        item.content?.plainText ||
                        "No content"}
                    </div>
                    <div className="lockin-note-card-meta">
                      Updated {relativeLabel(item.updatedAt || item.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
