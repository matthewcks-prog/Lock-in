import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Note } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { useNotesList } from '../useNotesList';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Sample note',
    content: {
      version: 'lexical_v1',
      editorState: null,
      legacyHtml: null,
      plainText: 'Sample note',
    },
    sourceUrl: null,
    sourceSelection: null,
    courseCode: null,
    noteType: 'manual',
    tags: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isStarred: false,
    previewText: 'Sample note',
    ...overrides,
  };
}

function createNotesServiceStub(overrides: Partial<NotesService> = {}): NotesService {
  return {
    listNotes: vi.fn().mockResolvedValue([]),
    getNote: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    toggleStar: vi.fn(),
    setStar: vi.fn(),
    listAssets: vi.fn(),
    uploadAsset: vi.fn(),
    deleteAsset: vi.fn(),
    ...overrides,
  } as NotesService;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises(cycles = 1) {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function NotesListHarness({ notesService }: { notesService: NotesService }) {
  const { notes, error, toggleStar } = useNotesList({ notesService, limit: 50 });

  return (
    <div>
      <div data-testid="notes-error">{error ?? ''}</div>
      <ul>
        {notes.map((note) => (
          <li key={note.id ?? ''} data-testid="note-item">
            <span data-testid={`note-title-${note.id}`}>{note.title}</span>
            <span data-testid={`note-star-${note.id}`}>
              {note.isStarred ? 'starred' : 'unstarred'}
            </span>
            <button
              data-testid={`note-toggle-${note.id}`}
              type="button"
              onClick={() => {
                void toggleStar(note.id as string).catch(() => undefined);
              }}
            >
              toggle
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('useNotesList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('loads notes from the service on mount', async () => {
    const note = createNote({ id: 'note-101', title: 'Week 3 summary' });
    const listNotes = vi.fn().mockResolvedValue([note]);
    const notesService = createNotesServiceStub({ listNotes });

    await act(async () => {
      root.render(<NotesListHarness notesService={notesService} />);
    });
    await act(async () => {
      await flushPromises(2);
    });

    expect(listNotes).toHaveBeenCalledWith({ limit: 50 });
    const title = document.querySelector('[data-testid="note-title-note-101"]');
    expect(title?.textContent).toBe('Week 3 summary');
  });

  it('rolls back star state when the toggle request fails', async () => {
    const note = createNote({ id: 'note-202', title: 'Lecture notes', isStarred: false });
    const listNotes = vi.fn().mockResolvedValue([note]);
    const deferred = createDeferred<Note>();
    const toggleStar = vi.fn().mockImplementation(() => deferred.promise);
    const notesService = createNotesServiceStub({ listNotes, toggleStar });

    await act(async () => {
      root.render(<NotesListHarness notesService={notesService} />);
    });
    await act(async () => {
      await flushPromises(2);
    });

    const toggleButton = document.querySelector(
      '[data-testid="note-toggle-note-202"]',
    ) as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();

    await act(async () => {
      toggleButton?.click();
    });
    await act(async () => {
      await flushPromises(2);
    });

    const optimisticStar = document.querySelector('[data-testid="note-star-note-202"]');
    expect(optimisticStar?.textContent).toBe('starred');

    await act(async () => {
      deferred.reject(new Error('Network error'));
      await flushPromises(2);
    });

    expect(toggleStar).toHaveBeenCalledWith('note-202');
    const star = document.querySelector('[data-testid="note-star-note-202"]');
    expect(star?.textContent).toBe('unstarred');
    const error = document.querySelector('[data-testid="notes-error"]');
    expect(error?.textContent).toContain('Network error');
  });
});
