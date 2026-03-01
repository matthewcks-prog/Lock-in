import { LexicalComposer } from '@lexical/react/LexicalComposer';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin as ReactLinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import type { LexicalEditor } from 'lexical';
import type { Note, NoteAsset, NoteContent } from '@core/domain/Note';
import { NoteToolbar } from './editor/NoteToolbar';
import { AssetCleanupPlugin } from './editor/plugins/AssetCleanupPlugin';
import { CaretScrollPlugin } from './editor/plugins/CaretScrollPlugin';
import { NoteChangePlugin } from './editor/plugins/NoteChangePlugin';
import { NoteContentLoader } from './editor/plugins/NoteContentLoader';
import { ShortcutsPlugin } from './editor/plugins/ShortcutsPlugin';
import { UploadPlugin } from './editor/plugins/UploadPlugin';

interface NoteEditorComposerBodyProps {
  composerKey: string;
  hasNoteId: boolean;
  initialConfig: InitialConfigType;
  isAssetUploading: boolean | undefined;
  isHydrating: boolean;
  note: Note | null;
  onContentChange: (content: NoteContent) => void;
  onDeleteAsset: ((assetId: string) => Promise<boolean>) | undefined;
  onOpenFilePicker: () => void;
  onSaveNow: (() => void) | undefined;
  onUploadFile: ((file: File) => Promise<NoteAsset | null>) | undefined;
  setComposerEditor: (editor: LexicalEditor) => void;
  setIsHydrating: (value: boolean) => void;
}

function NoteEditorSurface(): JSX.Element {
  return (
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
  );
}

function NoteEditorPlugins({
  isHydrating,
  note,
  onContentChange,
  onDeleteAsset,
  onSaveNow,
  onUploadFile,
  setComposerEditor,
  setIsHydrating,
}: Omit<
  NoteEditorComposerBodyProps,
  'composerKey' | 'hasNoteId' | 'initialConfig' | 'isAssetUploading' | 'onOpenFilePicker'
>): JSX.Element {
  return (
    <>
      <HistoryPlugin />
      <ListPlugin />
      <ReactLinkPlugin />
      <AutoFocusPlugin />
      <NoteContentLoader note={note} onHydrationChange={setIsHydrating} />
      <NoteChangePlugin onChange={onContentChange} isHydrating={isHydrating} />
      <ShortcutsPlugin {...(onSaveNow !== undefined ? { onSaveNow } : {})} />
      <CaretScrollPlugin />
      <UploadPlugin
        onEditorReady={setComposerEditor}
        {...(onUploadFile !== undefined ? { onUploadFile } : {})}
      />
      <AssetCleanupPlugin
        noteId={note?.id}
        isHydrating={isHydrating}
        {...(onDeleteAsset !== undefined ? { onDeleteAsset } : {})}
      />
    </>
  );
}

export function NoteEditorComposerBody({
  composerKey,
  hasNoteId,
  initialConfig,
  isAssetUploading,
  isHydrating,
  note,
  onContentChange,
  onDeleteAsset,
  onOpenFilePicker,
  onSaveNow,
  onUploadFile,
  setComposerEditor,
  setIsHydrating,
}: NoteEditorComposerBodyProps): JSX.Element {
  return (
    <LexicalComposer key={composerKey} initialConfig={initialConfig}>
      <NoteToolbar
        disableAttachment={!hasNoteId || onUploadFile === undefined}
        isUploading={Boolean(isAssetUploading)}
        {...(onUploadFile !== undefined ? { onOpenFilePicker } : {})}
      />
      <NoteEditorSurface />
      <NoteEditorPlugins
        isHydrating={isHydrating}
        note={note}
        onContentChange={onContentChange}
        onDeleteAsset={onDeleteAsset}
        onSaveNow={onSaveNow}
        onUploadFile={onUploadFile}
        setComposerEditor={setComposerEditor}
        setIsHydrating={setIsHydrating}
      />
    </LexicalComposer>
  );
}
