import { useCallback, useEffect, useState } from 'react';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $createCodeNode } from '@lexical/code';
import { $isListNode } from '@lexical/list';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import type { EditorState, LexicalEditor, RangeSelection } from 'lexical';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { HIGHLIGHT_COLORS, TEXT_COLORS, type BlockType } from './noteToolbarConstants';

function readSelectionFormats(selection: RangeSelection): Set<string> {
  const formats = new Set<string>();
  if (selection.hasFormat('bold')) formats.add('bold');
  if (selection.hasFormat('italic')) formats.add('italic');
  if (selection.hasFormat('underline')) formats.add('underline');
  if (selection.hasFormat('code')) formats.add('code');
  return formats;
}

function resolveBlockTypeFromSelection(selection: RangeSelection): BlockType {
  const anchorNode = selection.anchor.getNode();
  const element =
    anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
  if ($isHeadingNode(element)) return element.getTag() as BlockType;
  if ($isListNode(element)) return 'paragraph';
  return 'paragraph';
}

function resolveAlignmentFromSelection(selection: RangeSelection): string {
  const anchorNode = selection.anchor.getNode();
  const element =
    anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
  if (!$isElementNode(element)) return 'left';
  const formatType = element.getFormatType();
  return formatType.length > 0 ? formatType : 'left';
}

function applyStyle(editor: LexicalEditor, style: Record<string, string>): void {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      $patchStyleText(selection, style);
    }
  });
}

function setBlockType(editor: LexicalEditor, next: BlockType): void {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    if (next === 'paragraph') {
      $setBlocksType(selection, () => $createParagraphNode());
      return;
    }
    $setBlocksType(selection, () => $createHeadingNode(next));
  });
}

function insertCodeBlock(editor: LexicalEditor): void {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      $setBlocksType(selection, () => $createCodeNode());
    }
  });
}

interface SelectionToolbarState {
  blockType: BlockType;
  selectionFormats: Set<string>;
  alignment: string;
  handleBlockChange: (next: BlockType) => void;
}

function useSelectionToolbarState(editor: LexicalEditor): SelectionToolbarState {
  const [blockType, setBlockTypeState] = useState<BlockType>('paragraph');
  const [selectionFormats, setSelectionFormats] = useState<Set<string>>(new Set());
  const [alignment, setAlignment] = useState<string>('left');

  const syncToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      setSelectionFormats(readSelectionFormats(selection));
      setBlockTypeState(resolveBlockTypeFromSelection(selection));
      setAlignment(resolveAlignmentFromSelection(selection));
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
        editorState.read(syncToolbar);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          syncToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, syncToolbar]);

  const handleBlockChange = useCallback(
    (next: BlockType) => {
      setBlockTypeState(next);
      setBlockType(editor, next);
    },
    [editor],
  );

  return { blockType, selectionFormats, alignment, handleBlockChange };
}

interface ColorToolbarState {
  showColor: boolean;
  showHighlight: boolean;
  currentTextColor: string;
  currentHighlight: string;
  toggleColorMenu: () => void;
  toggleHighlightMenu: () => void;
  selectTextColor: (color: string) => void;
  selectHighlightColor: (color: string) => void;
}

function useColorToolbarState(editor: LexicalEditor): ColorToolbarState {
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [currentTextColor, setCurrentTextColor] = useState<string>(TEXT_COLORS[0] ?? '#111827');
  const [currentHighlight, setCurrentHighlight] = useState<string>(
    HIGHLIGHT_COLORS[5] ?? 'transparent',
  );

  const toggleColorMenu = useCallback(() => setShowColor((value) => !value), []);
  const toggleHighlightMenu = useCallback(() => setShowHighlight((value) => !value), []);

  const selectTextColor = useCallback(
    (color: string) => {
      applyStyle(editor, { color });
      setCurrentTextColor(color);
      setShowColor(false);
    },
    [editor],
  );

  const selectHighlightColor = useCallback(
    (color: string) => {
      applyStyle(editor, {
        'background-color': color === 'transparent' ? 'transparent' : color,
      });
      setCurrentHighlight(color);
      setShowHighlight(false);
    },
    [editor],
  );

  return {
    showColor,
    showHighlight,
    currentTextColor,
    currentHighlight,
    toggleColorMenu,
    toggleHighlightMenu,
    selectTextColor,
    selectHighlightColor,
  };
}

export interface NoteToolbarState extends SelectionToolbarState, ColorToolbarState {
  toggleLink: () => void;
  insertCodeBlock: () => void;
}

export function useNoteToolbarState(editor: LexicalEditor): NoteToolbarState {
  const selectionState = useSelectionToolbarState(editor);
  const colorState = useColorToolbarState(editor);

  const toggleLink = useCallback(() => {
    const url = window.prompt('Enter URL');
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url !== null && url.length > 0 ? url : null);
  }, [editor]);

  const handleInsertCodeBlock = useCallback(() => insertCodeBlock(editor), [editor]);

  return {
    ...selectionState,
    ...colorState,
    toggleLink,
    insertCodeBlock: handleInsertCodeBlock,
  };
}
