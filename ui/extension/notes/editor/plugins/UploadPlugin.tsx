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
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!onUploadFile || !files || files.length === 0) return;
      const file = files.item(0);
      if (!file) return;
      const asset = await onUploadFile(file);
      if (!asset) return;
      insertAssetIntoEditor(editor, asset);
    },
    [editor, onUploadFile],
  );

  useEffect(() => {
    if (!onUploadFile) return;
    const listener = (event: ClipboardEvent | DragEvent) => {
      const files =
        event instanceof ClipboardEvent
          ? event.clipboardData?.files
          : event instanceof DragEvent
            ? event.dataTransfer?.files
            : null;
      if (!files || files.length === 0) return;
      event.preventDefault();
      void handleFiles(files);
    };

    const rootElement = editor.getRootElement();
    if (!rootElement) return;
    rootElement.addEventListener('paste', listener);
    rootElement.addEventListener('drop', listener);
    return () => {
      rootElement.removeEventListener('paste', listener);
      rootElement.removeEventListener('drop', listener);
    };
  }, [editor, handleFiles, onUploadFile]);

  return null;
}
