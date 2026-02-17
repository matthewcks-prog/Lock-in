import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import type { LexicalEditor } from 'lexical';
import type { Note, NoteAsset, NoteContent, NoteStatus } from '@core/domain/Note';
import { AttachmentNode } from './nodes/AttachmentNode';
import { ImageNode } from './nodes/ImageNode';
import { buildStatusLabel } from './editor/buildStatusLabel';
import { noteEditorTheme } from './editor/noteEditorTheme';
import { insertAssetIntoEditor } from './editor/insertAssetIntoEditor';
import { NoteEditorComposerBody } from './NoteEditorComposerBody';

interface NoteEditorShellProps {
  note: Note | null;
  status: NoteStatus;
  title: string;
  onTitleChange: (next: string) => void;
  onContentChange: (content: NoteContent) => void;
  onSaveNow?: () => void;
  onUploadFile?: (file: File) => Promise<NoteAsset | null>;
  onDeleteAsset?: (assetId: string) => Promise<boolean>;
  isAssetUploading?: boolean;
  assetError?: string | null;
  editorError?: string | null;
}

function resolveInitialEditorState(note: Note | null): string | null {
  if (note?.content === null || note?.content === undefined) return null;
  if (
    note.content.version !== 'lexical_v1' ||
    note.content.editorState === null ||
    note.content.editorState === undefined
  ) {
    return null;
  }

  const state = note.content.editorState;
  if (typeof state === 'string') return state;
  if (typeof state !== 'object') return null;
  try {
    return JSON.stringify(state);
  } catch {
    return null;
  }
}

function useNoteEditorConfig(note: Note | null): {
  composerKey: string;
  initialConfig: InitialConfigType;
} {
  const composerKey = note?.id ?? 'new-note';
  const initialEditorState = useMemo(
    () => resolveInitialEditorState(note),
    [note?.id, note?.content?.editorState],
  );
  const initialConfig = useMemo<InitialConfigType>(() => {
    const baseConfig: InitialConfigType = {
      namespace: 'LockInNoteEditor',
      theme: noteEditorTheme,
      editable: true,
      onError(error: Error) {
        console.error('Lexical editor error', error);
      },
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        LinkNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        ImageNode,
        AttachmentNode,
      ],
    };
    return initialEditorState !== null
      ? { ...baseConfig, editorState: initialEditorState }
      : baseConfig;
  }, [initialEditorState]);
  return { composerKey, initialConfig };
}

function useStatusMeta({
  assetError,
  editorError,
  isAssetUploading,
  note,
  status,
}: {
  assetError: string | null | undefined;
  editorError: string | null | undefined;
  isAssetUploading: boolean | undefined;
  note: Note | null;
  status: NoteStatus;
}): ReturnType<typeof buildStatusLabel> {
  const metaOptions: {
    status: NoteStatus;
    updatedAt?: string | null;
    isAssetUploading?: boolean;
    error?: string | null;
  } = { status };
  if (note?.updatedAt !== undefined) metaOptions.updatedAt = note.updatedAt;
  if (isAssetUploading !== undefined) metaOptions.isAssetUploading = isAssetUploading;
  const combinedError = assetError ?? editorError;
  if (combinedError !== null && combinedError !== undefined && combinedError.length > 0) {
    metaOptions.error = combinedError;
  }
  return buildStatusLabel(metaOptions);
}

function useUploadState({
  onUploadFile,
}: {
  onUploadFile: ((file: File) => Promise<NoteAsset | null>) | undefined;
}): {
  fileInputRef: React.RefObject<HTMLInputElement>;
  setComposerEditor: (editor: LexicalEditor) => void;
  handleUploadClick: () => void;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
} {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [composerEditor, setComposerEditor] = useState<LexicalEditor | null>(null);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file !== undefined && onUploadFile !== undefined && composerEditor !== null) {
        void onUploadFile(file).then((asset) => {
          if (asset !== null) insertAssetIntoEditor(composerEditor, asset);
        });
      }
      if (fileInputRef.current !== null) fileInputRef.current.value = '';
    },
    [composerEditor, onUploadFile],
  );

  return { fileInputRef, setComposerEditor, handleUploadClick, handleFileInputChange };
}

function NoteEditorHeader({
  onTitleChange,
  statusMeta,
  title,
}: {
  onTitleChange: (next: string) => void;
  statusMeta: ReturnType<typeof buildStatusLabel>;
  title: string;
}): JSX.Element {
  return (
    <div className="lockin-note-shell-head">
      <input
        className="lockin-note-title-input"
        value={title}
        placeholder="Note title..."
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <div className={`lockin-note-status is-${statusMeta.tone}`}>
        {statusMeta.spinner ? <span className="lockin-inline-spinner" aria-hidden="true" /> : null}
        <span>{statusMeta.label}</span>
      </div>
    </div>
  );
}

function NoteEditorInlineError({
  assetError,
}: {
  assetError: string | null | undefined;
}): JSX.Element | null {
  if (assetError === null || assetError === undefined || assetError.length === 0) return null;
  return <div className="lockin-note-inline-error">{assetError}</div>;
}

function HiddenFileInput({
  fileInputRef,
  onChange,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}): JSX.Element {
  return (
    <input
      ref={fileInputRef}
      type="file"
      accept="*/*"
      style={{ display: 'none' }}
      onChange={onChange}
    />
  );
}

export function NoteEditorShell({
  note,
  status,
  title,
  onTitleChange,
  onContentChange,
  onSaveNow,
  onUploadFile,
  onDeleteAsset,
  isAssetUploading,
  assetError,
  editorError,
}: NoteEditorShellProps): JSX.Element {
  const [isHydrating, setIsHydrating] = useState(false);
  const { composerKey, initialConfig } = useNoteEditorConfig(note);
  const statusMeta = useStatusMeta({ assetError, editorError, isAssetUploading, note, status });
  const { fileInputRef, setComposerEditor, handleUploadClick, handleFileInputChange } =
    useUploadState({
      onUploadFile,
    });
  const hasNoteId = note?.id !== null && note?.id !== undefined && note.id.length > 0;

  return (
    <div className="lockin-note-shell-card">
      <NoteEditorHeader title={title} onTitleChange={onTitleChange} statusMeta={statusMeta} />
      <NoteEditorComposerBody
        composerKey={composerKey}
        hasNoteId={hasNoteId}
        initialConfig={initialConfig}
        isAssetUploading={isAssetUploading}
        isHydrating={isHydrating}
        note={note}
        onContentChange={onContentChange}
        onDeleteAsset={onDeleteAsset}
        onSaveNow={onSaveNow}
        onUploadFile={onUploadFile}
        setComposerEditor={setComposerEditor}
        setIsHydrating={setIsHydrating}
        onOpenFilePicker={handleUploadClick}
      />
      <NoteEditorInlineError assetError={assetError} />
      <HiddenFileInput fileInputRef={fileInputRef} onChange={handleFileInputChange} />
    </div>
  );
}

export const NoteEditor = NoteEditorShell;
