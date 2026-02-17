import { useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { NoteAsset } from '@core/domain/Note';
import type { LexicalEditor } from 'lexical';
import { insertAssetIntoEditor } from '../insertAssetIntoEditor';

export function UploadPlugin({
  onUploadFile,
  onEditorReady,
}: {
  onUploadFile?: (file: File) => Promise<NoteAsset | null>;
  onEditorReady?: (editor: LexicalEditor) => void;
}): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (onUploadFile === undefined || files === null || files.length === 0) return;
      const file = files.item(0);
      if (file === null) return;
      const asset = await onUploadFile(file);
      if (asset === null) return;
      insertAssetIntoEditor(editor, asset);
    },
    [editor, onUploadFile],
  );

  useEffect(() => {
    if (onUploadFile === undefined) return;
    const listener = (event: ClipboardEvent | DragEvent): void => {
      const files =
        event instanceof ClipboardEvent
          ? event.clipboardData?.files
          : event instanceof DragEvent
            ? event.dataTransfer?.files
            : null;
      if (files === null || files === undefined || files.length === 0) return;
      event.preventDefault();
      void handleFiles(files);
    };

    const rootElement = editor.getRootElement();
    if (rootElement === null) return;
    rootElement.addEventListener('paste', listener);
    rootElement.addEventListener('drop', listener);
    return () => {
      rootElement.removeEventListener('paste', listener);
      rootElement.removeEventListener('drop', listener);
    };
  }, [editor, handleFiles, onUploadFile]);

  return null;
}
