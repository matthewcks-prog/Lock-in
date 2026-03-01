import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  Code,
  Highlighter,
  Italic,
  Link,
  List,
  ListOrdered,
  Palette,
  Paperclip,
  Redo2,
  Underline,
  Undo2,
} from 'lucide-react';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import type { LexicalEditor } from 'lexical';
import { FORMAT_ELEMENT_COMMAND, FORMAT_TEXT_COMMAND, REDO_COMMAND, UNDO_COMMAND } from 'lexical';
import { HIGHLIGHT_COLORS, TEXT_COLORS } from './noteToolbarConstants';
import { BlockTypeSelect, SwatchMenu, ToolbarButton } from './noteToolbarControls';
import type { NoteToolbarState } from './useNoteToolbarState';

function ToolbarDivider(): JSX.Element {
  return <div className="lockin-note-toolbar-divider" />;
}

function TextFormattingGroup({
  editor,
  selectionFormats,
  toggleLink,
}: {
  editor: LexicalEditor;
  selectionFormats: Set<string>;
  toggleLink: () => void;
}): JSX.Element {
  return (
    <div className="lockin-note-toolbar-group">
      <ToolbarButton
        label="Bold"
        active={selectionFormats.has('bold')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <Bold size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={selectionFormats.has('italic')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      >
        <Italic size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={selectionFormats.has('underline')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      >
        <Underline size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={selectionFormats.has('code')}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
      >
        <Code size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton label="Link" onClick={toggleLink}>
        <Link size={16} strokeWidth={2.5} />
      </ToolbarButton>
    </div>
  );
}

function ColorGroup({
  currentTextColor,
  currentHighlight,
  showColor,
  showHighlight,
  toggleColorMenu,
  toggleHighlightMenu,
  selectTextColor,
  selectHighlightColor,
}: {
  currentTextColor: string;
  currentHighlight: string;
  showColor: boolean;
  showHighlight: boolean;
  toggleColorMenu: () => void;
  toggleHighlightMenu: () => void;
  selectTextColor: (color: string) => void;
  selectHighlightColor: (color: string) => void;
}): JSX.Element {
  return (
    <div className="lockin-note-toolbar-group lockin-note-toolbar-menu">
      <ToolbarButton label="Text color" onClick={toggleColorMenu} swatchColor={currentTextColor}>
        <Palette size={16} strokeWidth={2.5} />
      </ToolbarButton>
      {showColor ? (
        <SwatchMenu label="Text color" swatches={TEXT_COLORS} onSelect={selectTextColor} />
      ) : null}
      <ToolbarButton label="Highlight" onClick={toggleHighlightMenu} swatchColor={currentHighlight}>
        <Highlighter size={16} strokeWidth={2.5} />
      </ToolbarButton>
      {showHighlight ? (
        <SwatchMenu label="Highlight" swatches={HIGHLIGHT_COLORS} onSelect={selectHighlightColor} />
      ) : null}
    </div>
  );
}

function ListGroup({
  editor,
  insertCodeBlock,
}: {
  editor: LexicalEditor;
  insertCodeBlock: () => void;
}): JSX.Element {
  return (
    <div className="lockin-note-toolbar-group">
      <ToolbarButton
        label="Bulleted list"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      >
        <List size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      >
        <ListOrdered size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton label="Code block" onClick={insertCodeBlock}>
        <Braces size={16} strokeWidth={2.5} />
      </ToolbarButton>
    </div>
  );
}

function AlignmentGroup({
  editor,
  alignment,
}: {
  editor: LexicalEditor;
  alignment: string;
}): JSX.Element {
  return (
    <div className="lockin-note-toolbar-group">
      <ToolbarButton
        label="Align left"
        active={alignment === 'left' || alignment === 'start'}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
      >
        <AlignLeft size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={alignment === 'center'}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
      >
        <AlignCenter size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={alignment === 'right' || alignment === 'end'}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
      >
        <AlignRight size={16} strokeWidth={2.5} />
      </ToolbarButton>
    </div>
  );
}

function AttachmentGroup({
  disableAttachment,
  isUploading,
  onOpenFilePicker,
}: {
  disableAttachment: boolean;
  isUploading: boolean;
  onOpenFilePicker?: () => void;
}): JSX.Element {
  return (
    <div className="lockin-note-toolbar-group">
      <ToolbarButton
        label="Attach file"
        disabled={disableAttachment}
        {...(onOpenFilePicker !== undefined ? { onClick: onOpenFilePicker } : {})}
      >
        <Paperclip size={16} strokeWidth={2.5} />
      </ToolbarButton>
      {isUploading ? <span className="lockin-inline-spinner" aria-label="Uploading" /> : null}
    </div>
  );
}

function HistoryGroup({ editor }: { editor: LexicalEditor }): JSX.Element {
  return (
    <div className="lockin-note-toolbar-group">
      <ToolbarButton label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo2 size={16} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo2 size={16} strokeWidth={2.5} />
      </ToolbarButton>
    </div>
  );
}

interface NoteToolbarViewProps {
  editor: LexicalEditor;
  state: NoteToolbarState;
  onOpenFilePicker?: () => void;
  disableAttachment?: boolean;
  isUploading?: boolean;
}

export function NoteToolbarView({
  editor,
  state,
  onOpenFilePicker,
  disableAttachment,
  isUploading,
}: NoteToolbarViewProps): JSX.Element {
  return (
    <div className="lockin-note-toolbar">
      <div className="lockin-note-toolbar-group">
        <BlockTypeSelect value={state.blockType} onChange={state.handleBlockChange} />
      </div>
      <ToolbarDivider />
      <TextFormattingGroup
        editor={editor}
        selectionFormats={state.selectionFormats}
        toggleLink={state.toggleLink}
      />
      <ToolbarDivider />
      <ColorGroup
        currentTextColor={state.currentTextColor}
        currentHighlight={state.currentHighlight}
        showColor={state.showColor}
        showHighlight={state.showHighlight}
        toggleColorMenu={state.toggleColorMenu}
        toggleHighlightMenu={state.toggleHighlightMenu}
        selectTextColor={state.selectTextColor}
        selectHighlightColor={state.selectHighlightColor}
      />
      <ToolbarDivider />
      <ListGroup editor={editor} insertCodeBlock={state.insertCodeBlock} />
      <ToolbarDivider />
      <AlignmentGroup editor={editor} alignment={state.alignment} />
      <ToolbarDivider />
      <AttachmentGroup
        disableAttachment={Boolean(disableAttachment)}
        isUploading={Boolean(isUploading)}
        {...(onOpenFilePicker !== undefined ? { onOpenFilePicker } : {})}
      />
      <ToolbarDivider />
      <HistoryGroup editor={editor} />
    </div>
  );
}
