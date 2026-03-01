import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { LexicalEditor, NodeKey } from 'lexical';
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';

function removeImageNode(editor: LexicalEditor, nodeKey: NodeKey): void {
  editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if (node === null || node.getType() !== 'image') {
      return;
    }
    node.remove();
  });
}

function isResizeHandleTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    typeof target.dataset['resizeHandle'] === 'string' &&
    target.dataset['resizeHandle'].length > 0
  );
}

function registerClickSelectionCommand({
  editor,
  containerRef,
  isSelected,
  setSelected,
  clearSelection,
}: {
  editor: LexicalEditor;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isSelected: boolean;
  setSelected: (value: boolean) => void;
  clearSelection: () => void;
}): () => void {
  return editor.registerCommand(
    CLICK_COMMAND,
    (event: MouseEvent) => {
      const container = containerRef.current;
      if (
        container === null ||
        !(event.target instanceof Node) ||
        !container.contains(event.target)
      ) {
        return false;
      }
      if (isResizeHandleTarget(event.target)) {
        return false;
      }
      if (event.shiftKey) {
        setSelected(!isSelected);
      } else {
        clearSelection();
        setSelected(true);
      }
      return true;
    },
    COMMAND_PRIORITY_LOW,
  );
}

function registerRemoveSelectionCommand({
  editor,
  nodeKey,
  isSelected,
  command,
}: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  isSelected: boolean;
  command: typeof KEY_DELETE_COMMAND | typeof KEY_BACKSPACE_COMMAND;
}): () => void {
  return editor.registerCommand(
    command,
    (event) => {
      if (!isSelected) {
        return false;
      }
      event?.preventDefault();
      removeImageNode(editor, nodeKey);
      return true;
    },
    COMMAND_PRIORITY_LOW,
  );
}

export function useImageNodeSelectionCommands({
  editor,
  nodeKey,
  containerRef,
  isSelected,
  setSelected,
  clearSelection,
}: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  isSelected: boolean;
  setSelected: (value: boolean) => void;
  clearSelection: () => void;
}): void {
  useEffect(() => {
    return mergeRegister(
      registerClickSelectionCommand({
        editor,
        containerRef,
        isSelected,
        setSelected,
        clearSelection,
      }),
      registerRemoveSelectionCommand({
        editor,
        nodeKey,
        isSelected,
        command: KEY_DELETE_COMMAND,
      }),
      registerRemoveSelectionCommand({
        editor,
        nodeKey,
        isSelected,
        command: KEY_BACKSPACE_COMMAND,
      }),
    );
  }, [clearSelection, containerRef, editor, isSelected, nodeKey, setSelected]);
}
