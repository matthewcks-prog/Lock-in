import { useCallback, useMemo, useRef, useState } from 'react';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin as ReactLinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import type { LexicalEditor } from 'lexical';
import type { Note, NoteAsset, NoteContent, NoteStatus } from '@core/domain/Note';
import { AttachmentNode } from './nodes/AttachmentNode';
import { ImageNode } from './nodes/ImageNode';
import { buildStatusLabel } from './editor/buildStatusLabel';
import { noteEditorTheme } from './editor/noteEditorTheme';
import { insertAssetIntoEditor } from './editor/insertAssetIntoEditor';
import { NoteToolbar } from './editor/NoteToolbar';
import { AssetCleanupPlugin } from './editor/plugins/AssetCleanupPlugin';
import { CaretScrollPlugin } from './editor/plugins/CaretScrollPlugin';
import { NoteChangePlugin } from './editor/plugins/NoteChangePlugin';
import { NoteContentLoader } from './editor/plugins/NoteContentLoader';
import { ShortcutsPlugin } from './editor/plugins/ShortcutsPlugin';
import { UploadPlugin } from './editor/plugins/UploadPlugin';

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
}: NoteEditorShellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [composerEditor, setComposerEditor] = useState<LexicalEditor | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  // Use note.id for existing notes, or a stable "new" key for drafts
  // This forces LexicalComposer to remount when switching notes
  const composerKey = note?.id ?? 'new-note';

  const initialEditorState = useMemo(() => {
    if (!note?.content) return null;
    if (note.content.version === 'lexical_v1' && note.content.editorState) {
      const state = note.content.editorState;
      if (typeof state === 'string') return state;
      if (state && typeof state === 'object') {
        try {
          return JSON.stringify(state);
        } catch {
          return null;
        }
      }
      return null;
    }
    return null;
  }, [note?.id, note?.content?.editorState]);

  const initialConfig: InitialConfigType = useMemo(() => {
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
    if (initialEditorState) {
      return { ...baseConfig, editorState: initialEditorState };
    }
    return baseConfig;
  }, [initialEditorState]);

  const statusMeta = (() => {
    const metaOptions: {
      status: NoteStatus;
      updatedAt?: string | null;
      isAssetUploading?: boolean;
      error?: string | null;
    } = { status };
    if (note?.updatedAt !== undefined) {
      metaOptions.updatedAt = note.updatedAt;
    }
    if (isAssetUploading !== undefined) {
      metaOptions.isAssetUploading = isAssetUploading;
    }
    const combinedError = assetError || editorError;
    if (combinedError !== undefined) {
      metaOptions.error = combinedError;
    }
    return buildStatusLabel(metaOptions);
  })();

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="lockin-note-shell-card">
      <div className="lockin-note-shell-head">
        <input
          className="lockin-note-title-input"
          value={title}
          placeholder="Note title..."
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <div className={`lockin-note-status is-${statusMeta.tone}`}>
          {statusMeta.spinner ? (
            <span className="lockin-inline-spinner" aria-hidden="true" />
          ) : null}
          <span>{statusMeta.label}</span>
        </div>
      </div>

      <LexicalComposer key={composerKey} initialConfig={initialConfig}>
        <NoteToolbar
          disableAttachment={!note?.id || !onUploadFile}
          isUploading={Boolean(isAssetUploading)}
          {...(onUploadFile ? { onOpenFilePicker: handleUploadClick } : {})}
        />

        <div className="lockin-note-editor-surface">
          <div className="lockin-note-editor-scroll">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="lockin-note-editor-area"
                  data-placeholder="Write your note here..."
                />
              }
              placeholder={<div className="lockin-note-placeholder">Write your note here...</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>

        <HistoryPlugin />
        <ListPlugin />
        <ReactLinkPlugin />
        <AutoFocusPlugin />
        <NoteContentLoader note={note} onHydrationChange={setIsHydrating} />
        <NoteChangePlugin onChange={onContentChange} isHydrating={isHydrating} />
        <ShortcutsPlugin {...(onSaveNow ? { onSaveNow } : {})} />
        <CaretScrollPlugin />
        <UploadPlugin
          onEditorReady={setComposerEditor}
          {...(onUploadFile ? { onUploadFile } : {})}
        />
        <AssetCleanupPlugin
          noteId={note?.id}
          isHydrating={isHydrating}
          {...(onDeleteAsset ? { onDeleteAsset } : {})}
        />
      </LexicalComposer>

      {assetError ? <div className="lockin-note-inline-error">{assetError}</div> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onUploadFile && composerEditor) {
            void onUploadFile(file).then((asset) => {
              if (asset) {
                insertAssetIntoEditor(composerEditor, asset);
              }
            });
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
}

export const NoteEditor = NoteEditorShell;
