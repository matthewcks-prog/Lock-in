import { useEffect, useRef } from 'react';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot, type EditorState } from 'lexical';
import type { NoteContent } from '@core/domain/Note';

export function NoteChangePlugin({
  onChange,
  isHydrating,
}: {
  onChange: (content: NoteContent) => void;
  isHydrating: boolean;
}) {
  const isFirstChangeRef = useRef(true);

  // Reset on mount (when editor remounts for a new note)
  useEffect(() => {
    isFirstChangeRef.current = true;
  }, []);

  return (
    <OnChangePlugin
      ignoreSelectionChange={true}
      onChange={(editorState: EditorState) => {
        // Skip the initial change event that fires when the editor first loads
        // and skip changes during hydration to prevent save loops
        if (isFirstChangeRef.current) {
          isFirstChangeRef.current = false;
          if (isHydrating) {
            return;
          }
        }
        if (isHydrating) {
          return;
        }
        const plainText = editorState.read(() => $getRoot().getTextContent());
        onChange({
          version: 'lexical_v1',
          editorState: editorState.toJSON(),
          plainText,
        });
      }}
    />
  );
}
