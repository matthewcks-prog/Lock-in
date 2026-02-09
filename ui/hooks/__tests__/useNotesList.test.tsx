import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { NotesService } from '@core/services/notesService';
import type { Note } from '@core/domain/Note';
import { useNotesList } from '../useNotesList';
import {
  createDeferred,
  createNote,
  createNotesServiceStub,
  renderWithProviders,
} from '@shared/test';

function NotesListHarness({ notesService }: { notesService: NotesService }) {
  const { notes, error, toggleStar } = useNotesList({ notesService, limit: 50 });

  return (
    <div>
      {error && <div role="alert">{error}</div>}
      <ul aria-label="Notes list">
        {notes.map((note) => (
          <li key={note.id ?? ''}>
            <span>{note.title}</span>
            <span aria-label={`Star status for ${note.title}`}>
              {note.isStarred ? 'starred' : 'unstarred'}
            </span>
            <button
              type="button"
              aria-label={`Toggle star for ${note.title}`}
              onClick={() => {
                void toggleStar(note.id as string).catch(() => undefined);
              }}
            >
              Toggle star
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('useNotesList', () => {
  it('loads notes from the service on mount', async () => {
    const note = createNote({ id: 'note-101', title: 'Week 3 summary' });
    const listNotes = vi.fn().mockResolvedValue([note]);
    const notesService = createNotesServiceStub({ listNotes });

    renderWithProviders(<NotesListHarness notesService={notesService} />);

    expect(await screen.findByText('Week 3 summary')).toBeInTheDocument();
    expect(listNotes).toHaveBeenCalledWith({ limit: 50 });
  });

  it('rolls back star state when the toggle request fails', async () => {
    const note = createNote({ id: 'note-202', title: 'Lecture notes', isStarred: false });
    const listNotes = vi.fn().mockResolvedValue([note]);
    const deferred = createDeferred<Note>();
    const toggleStar = vi.fn().mockImplementation(async () => deferred.promise);
    const notesService = createNotesServiceStub({ listNotes, toggleStar });

    const { user } = renderWithProviders(<NotesListHarness notesService={notesService} />);

    await screen.findByText('Lecture notes');

    const toggleButton = screen.getByRole('button', { name: /toggle star for lecture notes/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/star status for lecture notes/i)).toHaveTextContent('starred');
    });

    deferred.reject(new Error('Network error'));

    await waitFor(() => {
      expect(screen.getByLabelText(/star status for lecture notes/i)).toHaveTextContent(
        'unstarred',
      );
    });

    expect(toggleStar).toHaveBeenCalledWith('note-202');
    expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
  });
});
