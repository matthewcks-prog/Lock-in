import { NotesPanelView } from './panel/NotesPanelView';
import { useNotesPanelModel, type NotesPanelProps } from './panel/useNotesPanelModel';

export type { NotesPanelProps } from './panel/useNotesPanelModel';

export function NotesPanel(props: NotesPanelProps): JSX.Element {
  const model = useNotesPanelModel(props);
  return <NotesPanelView model={model} />;
}
