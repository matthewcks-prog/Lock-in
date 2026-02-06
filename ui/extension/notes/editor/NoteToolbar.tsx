import { useCallback, useEffect, useState } from 'react';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
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
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  EditorState,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3';

const BLOCK_OPTIONS: Array<{ value: BlockType; label: string }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
];

const TEXT_COLORS = ['#111827', '#334155', '#2563eb', '#7c3aed', '#dc2626', '#059669', '#f59e0b'];
const HIGHLIGHT_COLORS = ['#fef3c7', '#e0f2fe', '#f3e8ff', '#dcfce7', '#fee2e2', 'transparent'];

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="lockin-tooltip-wrapper">
      {children}
      <span className="lockin-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
  swatchColor,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  swatchColor?: string | null;
}) {
  return (
    <Tooltip text={label}>
      <button
        type="button"
        className={`lockin-note-tool-btn${active ? ' is-active' : ''}`}
        aria-pressed={active}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {children || label}
        {swatchColor && (
          <span
            className="lockin-tool-swatch"
            style={{
              background:
                swatchColor === 'transparent'
                  ? 'linear-gradient(135deg, #fff 45%, #f00 50%, #fff 55%)'
                  : swatchColor,
            }}
          />
        )}
      </button>
    </Tooltip>
  );
}

function BlockTypeSelect({
  value,
  onChange,
}: {
  value: BlockType;
  onChange: (next: BlockType) => void;
}) {
  return (
    <select
      className="lockin-note-block-select"
      value={value}
      onChange={(event) => onChange(event.target.value as BlockType)}
      aria-label="Block type"
    >
      {BLOCK_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SwatchMenu({
  swatches,
  onSelect,
  label,
}: {
  swatches: string[];
  onSelect: (color: string) => void;
  label: string;
}) {
  return (
    <div className="lockin-note-color-menu" role="listbox" aria-label={label}>
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          className="lockin-color-swatch"
          style={{ background: color === 'transparent' ? 'white' : color }}
          onClick={() => onSelect(color)}
          aria-label={`${label} ${color}`}
        />
      ))}
    </div>
  );
}

export function NoteToolbar({
  onOpenFilePicker,
  disableAttachment,
  isUploading,
}: {
  onOpenFilePicker?: () => void;
  disableAttachment?: boolean;
  isUploading?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockTypeState] = useState<BlockType>('paragraph');
  const [selectionFormats, setSelectionFormats] = useState<Set<string>>(new Set());
  const [alignment, setAlignment] = useState<string>('left');
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [currentTextColor, setCurrentTextColor] = useState<string>(TEXT_COLORS[0] ?? '#111827');
  const [currentHighlight, setCurrentHighlight] = useState<string>('transparent');

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();

      const formats = new Set<string>();
      if (selection.hasFormat('bold')) formats.add('bold');
      if (selection.hasFormat('italic')) formats.add('italic');
      if (selection.hasFormat('underline')) formats.add('underline');
      if (selection.hasFormat('code')) formats.add('code');
      setSelectionFormats(formats);

      if ($isHeadingNode(element)) {
        setBlockTypeState(element.getTag() as BlockType);
      } else if ($isListNode(element)) {
        setBlockTypeState('paragraph');
      } else {
        const type = element.getType();
        setBlockTypeState(type === 'paragraph' ? 'paragraph' : 'paragraph');
      }

      // Check format type for alignment - only ElementNode has getFormatType
      if ($isElementNode(element)) {
        const formatType = element.getFormatType();
        setAlignment(formatType || 'left');
      } else {
        setAlignment('left');
      }
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
        editorState.read(() => updateToolbar());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateToolbar]);

  const applyStyle = useCallback(
    (style: Record<string, string>) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, style);
        }
      });
    },
    [editor],
  );

  const handleBlockChange = (next: BlockType) => {
    setBlockTypeState(next);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (next === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(next));
        }
      }
    });
  };

  const toggleLink = useCallback(() => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor]);

  return (
    <div className="lockin-note-toolbar">
      <div className="lockin-note-toolbar-group">
        <BlockTypeSelect value={blockType} onChange={handleBlockChange} />
      </div>

      <div className="lockin-note-toolbar-divider" />

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

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group lockin-note-toolbar-menu">
        <ToolbarButton
          label="Text color"
          onClick={() => setShowColor((v) => !v)}
          swatchColor={currentTextColor}
        >
          <Palette size={16} strokeWidth={2.5} />
        </ToolbarButton>
        {showColor ? (
          <SwatchMenu
            label="Text color"
            swatches={TEXT_COLORS}
            onSelect={(color) => {
              applyStyle({ color });
              setCurrentTextColor(color);
              setShowColor(false);
            }}
          />
        ) : null}
        <ToolbarButton
          label="Highlight"
          onClick={() => setShowHighlight((v) => !v)}
          swatchColor={currentHighlight}
        >
          <Highlighter size={16} strokeWidth={2.5} />
        </ToolbarButton>
        {showHighlight ? (
          <SwatchMenu
            label="Highlight"
            swatches={HIGHLIGHT_COLORS}
            onSelect={(color) => {
              if (color === 'transparent') {
                applyStyle({ 'background-color': 'transparent' });
              } else {
                applyStyle({ 'background-color': color });
              }
              setCurrentHighlight(color);
              setShowHighlight(false);
            }}
          />
        ) : null}
      </div>

      <div className="lockin-note-toolbar-divider" />

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
        <ToolbarButton
          label="Code block"
          onClick={() => {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createCodeNode());
              }
            });
          }}
        >
          <Braces size={16} strokeWidth={2.5} />
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

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

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Attach file"
          disabled={Boolean(disableAttachment)}
          {...(onOpenFilePicker ? { onClick: onOpenFilePicker } : {})}
        >
          <Paperclip size={16} strokeWidth={2.5} />
        </ToolbarButton>
        {isUploading ? <span className="lockin-inline-spinner" aria-label="Uploading" /> : null}
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
          <Undo2 size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
          <Redo2 size={16} strokeWidth={2.5} />
        </ToolbarButton>
      </div>
    </div>
  );
}
