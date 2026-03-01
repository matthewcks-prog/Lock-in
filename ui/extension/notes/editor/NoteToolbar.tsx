import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { NoteToolbarView } from './NoteToolbarView';
import { useNoteToolbarState } from './useNoteToolbarState';

interface NoteToolbarProps {
  onOpenFilePicker?: () => void;
  disableAttachment?: boolean;
  isUploading?: boolean;
}

export function NoteToolbar({
  onOpenFilePicker,
  disableAttachment,
  isUploading,
}: NoteToolbarProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const state = useNoteToolbarState(editor);

  return (
    <NoteToolbarView
      editor={editor}
      state={state}
      {...(onOpenFilePicker !== undefined ? { onOpenFilePicker } : {})}
      {...(disableAttachment !== undefined ? { disableAttachment } : {})}
      {...(isUploading !== undefined ? { isUploading } : {})}
    />
  );
}
