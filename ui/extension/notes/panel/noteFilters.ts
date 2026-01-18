import type { Note } from '@core/domain/Note';

export function filterNotes({
  notes,
  courseCode,
  filter,
  search,
}: {
  notes: Note[];
  courseCode: string | null;
  filter: 'course' | 'all' | 'starred';
  search: string;
}): Note[] {
  const searchTerm = search.trim().toLowerCase();
  return notes.filter((item) => {
    let matchesFilter = false;

    if (filter === 'all') {
      matchesFilter = true;
    } else if (filter === 'course') {
      if (courseCode != null) {
        matchesFilter = item.courseCode === courseCode;
      } else {
        matchesFilter = item.courseCode == null;
      }
    } else if (filter === 'starred') {
      matchesFilter = item.isStarred === true;
    }

    const preview = item.previewText || item.content?.plainText || '';
    const matchesSearch =
      !searchTerm ||
      item.title.toLowerCase().includes(searchTerm) ||
      preview.toLowerCase().includes(searchTerm);

    return matchesFilter && matchesSearch;
  });
}
