/**
 * Note Domain Model and Utilities
 * 
 * Pure domain logic for notes - no Chrome dependencies.
 */

import type { Note, NoteType } from "./types";

/**
 * Create an empty note with default values
 */
export function createEmptyNote(prefill: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: prefill.id || null,
    title: prefill.title || "",
    content: prefill.content || "",
    sourceUrl: prefill.sourceUrl || "",
    courseCode: prefill.courseCode || null,
    linkedLabel: prefill.linkedLabel || "",
    sourceSelection: prefill.sourceSelection || "",
    noteType: prefill.noteType || "manual",
    tags: prefill.tags || [],
    createdAt: prefill.createdAt || now,
    updatedAt: prefill.updatedAt || now,
    isStarred: prefill.isStarred || false,
  };
}

/**
 * Normalize a note from API response (handles snake_case to camelCase)
 */
export function normalizeNote(rawNote: any): Note {
  return {
    id: rawNote.id || rawNote.note_id || null,
    title: rawNote.title || "Untitled Note",
    content: rawNote.content || "",
    sourceUrl: rawNote.source_url || rawNote.sourceUrl || "",
    courseCode: rawNote.course_code || rawNote.courseCode || null,
    sourceSelection: rawNote.source_selection || rawNote.sourceSelection || "",
    noteType: (rawNote.note_type || rawNote.noteType || "manual") as NoteType,
    tags: Array.isArray(rawNote.tags) ? rawNote.tags : [],
    createdAt: rawNote.created_at || rawNote.createdAt || null,
    updatedAt:
      rawNote.updated_at ||
      rawNote.updatedAt ||
      rawNote.created_at ||
      rawNote.createdAt ||
      null,
    linkedLabel:
      rawNote.linkedLabel ||
      rawNote.sourceSelection ||
      rawNote.title ||
      "",
    isStarred: rawNote.is_starred || rawNote.isStarred || false,
  };
}

/**
 * Sanitize note content HTML to prevent XSS
 */
export function sanitizeNoteContent(html: string): string {
  if (typeof html !== "string" || !html) return "";

  const container = document.createElement("div");
  container.innerHTML = html;

  // Remove script and style tags
  container.querySelectorAll("script, style").forEach((node) => node.remove());

  // Remove event handlers from all elements
  container.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return container.innerHTML;
}

/**
 * Strip HTML tags from note content
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

/**
 * Truncate text to max length
 */
export function truncateText(text: string, maxLength: number): string {
  const value = text || "";
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength - 1)}…`;
}

/**
 * Check if note matches filter criteria
 */
export function noteMatchesFilter(
  note: Note,
  filter: "page" | "course" | "all" | "starred",
  currentUrl?: string,
  currentCourseCode?: string | null
): boolean {
  if (!filter || filter === "all") return true;

  if (filter === "page") {
    if (!currentUrl) return false;
    return normalizeUrl(note.sourceUrl) === normalizeUrl(currentUrl);
  }

  if (filter === "course") {
    if (!currentCourseCode) {
      // Fallback to page filter if no course code
      if (!currentUrl) return false;
      return normalizeUrl(note.sourceUrl) === normalizeUrl(currentUrl);
    }
    if (!note.courseCode) {
      // Notes without course code match if they're from the same page
      if (!currentUrl) return false;
      return normalizeUrl(note.sourceUrl) === normalizeUrl(currentUrl);
    }
    return note.courseCode.toUpperCase() === currentCourseCode.toUpperCase();
  }

  if (filter === "starred") {
    return note.isStarred === true || (Array.isArray(note.tags) && note.tags.includes("starred"));
  }

  return true;
}

/**
 * Normalize URL for comparison (remove hash, trailing slash)
 */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch (error) {
    return url;
  }
}
