import { useEffect, useMemo, useState } from "react";
import type { Note } from "../../core/domain/Note.ts";
import type { NotesService } from "../../core/services/notesService.ts";
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

function formatLinkedTarget(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const cleanPath = parsed.pathname.replace(/\/$/, "") || "/";
    const shortPath = cleanPath.length > 32 ? `${cleanPath.slice(0, 32)}...` : cleanPath;
    return `${parsed.hostname}${shortPath}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}...` : url;
  }
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
}: NotesPanelProps) {
  const [view, setView] = useState<"current" | "all">("current");
  const [filter, setFilter] = useState<"page" | "course" | "all" | "starred">("course");
  const [search, setSearch] = useState("");

  const {
    note,
    status,
    error: editorError,
    activeNoteId: editorActiveId,
    setActiveNoteId,
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
  } = useNoteEditor({
    noteId: activeNoteId,
    notesService,
    defaultCourseCode: courseCode,
    defaultSourceUrl: pageUrl,
  });

  useEffect(() => {
    if (activeNoteId && activeNoteId !== editorActiveId) {
      setActiveNoteId(activeNoteId);
    }
  }, [activeNoteId, editorActiveId, setActiveNoteId]);

  useEffect(() => {
    if (editorActiveId !== activeNoteId) {
      onSelectNote(editorActiveId);
    }
  }, [activeNoteId, editorActiveId, onSelectNote]);

  useEffect(() => {
    if (status === "saved" && note) {
      onNoteSaved(note);
    }
  }, [note, onNoteSaved, status]);

  const {
    isUploading: isAssetUploading,
    error: noteAssetError,
    uploadAsset,
    deleteAsset,
  } = useNoteAssets(editorActiveId, notesService);

  const filteredNotes = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return notes.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "course" && item.courseCode === courseCode) ||
        (filter === "page" && item.sourceUrl === pageUrl) ||
        (filter === "starred" && item.isStarred);
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

  const linkedTarget = note?.sourceUrl || pageUrl;
  const linkedLabel = formatLinkedTarget(linkedTarget);

  return (
    <div className="lockin-notes-view">
      <div className="lockin-notes-header">
        <div className="lockin-notes-header-left">
          <div className="lockin-note-course-line">
            <span className="lockin-note-label">Course:</span>
            <span className="lockin-note-course-code">{courseCode || "None"}</span>
          </div>
          <div className="lockin-note-link-line">
            <span className="lockin-note-label">Linked to:</span>
            {linkedTarget ? (
              <a href={linkedTarget} target="_blank" rel="noreferrer" className="lockin-note-link-inline">
                {linkedLabel}
              </a>
            ) : (
              <span className="lockin-note-link-empty">Not linked</span>
            )}
          </div>
        </div>
        <div className="lockin-notes-header-middle">
          <div className="lockin-notes-toggle">
            <button
              className={`lockin-notes-toggle-btn ${view === "current" ? "is-active" : ""}`}
              onClick={() => setView("current")}
            >
              Current
            </button>
            <button
              className={`lockin-notes-toggle-btn ${view === "all" ? "is-active" : ""}`}
              onClick={() => setView("all")}
            >
              All notes
            </button>
          </div>
        </div>
        <div className="lockin-notes-header-right">
          <button className="lockin-btn-primary" onClick={handleNewNote}>
            + New note
          </button>
        </div>
      </div>

      <div className="lockin-notes-body">
        <div className={`lockin-note-current-view ${view === "current" ? "is-active" : ""}`}>
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
        </div>

        <div className={`lockin-all-notes-view ${view === "all" ? "is-active" : ""}`}>
          <div className="lockin-notes-filter-bar">
            <div className="lockin-notes-filter-left">
              <span className="lockin-filter-label">Filter</span>
              <select
                className="lockin-notes-filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
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
                placeholder="Search notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="lockin-notes-refresh">
              <button className="lockin-btn-ghost" onClick={onRefreshNotes} type="button">
                Refresh
              </button>
            </div>
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
                  className={`lockin-note-card ${
                    item.id && item.id === editorActiveId ? "is-active" : ""
                  }`}
                  onClick={() => onSelectNote(item.id || null)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="lockin-note-card-head">
                    <div className="lockin-note-card-title">{item.title}</div>
                    <div className="lockin-note-card-badges">
                      {item.courseCode ? (
                        <span className="lockin-note-badge">{item.courseCode}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="lockin-note-card-snippet">
                    {item.previewText || item.content?.plainText || "No content"}
                  </div>
                  <div className="lockin-note-card-meta">
                    Updated {relativeLabel(item.updatedAt || item.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
