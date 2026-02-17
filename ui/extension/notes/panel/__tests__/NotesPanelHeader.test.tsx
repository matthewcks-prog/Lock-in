import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Note } from '@core/domain/Note';
import { NotesPanelHeader } from '../NotesPanelHeader';

vi.mock('../../export', () => ({
  ExportDropdown: ({ disabled }: { disabled: boolean }) => (
    <button type="button" aria-label="Export note" disabled={disabled}>
      Export
    </button>
  ),
}));

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    content: {
      version: 'lexical_v1',
      editorState: {},
    },
    sourceUrl: null,
    sourceSelection: null,
    courseCode: 'COMP101',
    noteType: 'manual',
    tags: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

type NotesPanelHeaderProps = ComponentProps<typeof NotesPanelHeader>;

function createProps(overrides: Partial<NotesPanelHeaderProps> = {}): NotesPanelHeaderProps {
  return {
    courseCode: 'COMP101',
    weekLabel: 'Week 3',
    linkedTarget: 'https://example.edu/week-3',
    view: 'current',
    onViewChange: vi.fn(),
    showActions: true,
    isStarred: false,
    isDeleting: false,
    onToggleStar: vi.fn(),
    onDeleteNote: vi.fn(),
    onNewNote: vi.fn(),
    note: createNote(),
    week: 3,
    onExportError: vi.fn(),
    ...overrides,
  };
}

describe('NotesPanelHeader', () => {
  it('renders header metadata and wires primary actions', () => {
    const props = createProps();
    render(<NotesPanelHeader {...props} />);

    expect(screen.getByText('Course:')).toBeInTheDocument();
    expect(screen.getByText('COMP101')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Week 3' })).toHaveAttribute(
      'href',
      'https://example.edu/week-3',
    );

    fireEvent.click(screen.getByRole('button', { name: 'All notes' }));
    expect(props.onViewChange).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getByRole('button', { name: 'Star note' }));
    expect(props.onToggleStar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(props.onDeleteNote).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /\+ New note/i }));
    expect(props.onNewNote).toHaveBeenCalledTimes(1);
  });

  it('disables export/star/delete actions when actions are hidden', () => {
    render(
      <NotesPanelHeader
        {...createProps({
          courseCode: null,
          weekLabel: null,
          linkedTarget: null,
          showActions: false,
          isStarred: true,
          isDeleting: true,
        })}
      />,
    );

    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unstar note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled();
  });
});
