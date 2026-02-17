import { useEffect, useRef, type MutableRefObject } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $nodesOfType } from 'lexical';
import { AttachmentNode, $isAttachmentNode } from '../../nodes/AttachmentNode';
import { ImageNode, $isImageNode } from '../../nodes/ImageNode';

function isDefinedAssetId(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.length > 0;
}

export function AssetCleanupPlugin({
  noteId,
  onDeleteAsset,
  isHydrating,
}: {
  noteId: string | null | undefined;
  onDeleteAsset?: (assetId: string) => Promise<boolean>;
  isHydrating: boolean;
}): null {
  const [editor] = useLexicalComposerContext();
  const assetKeyMapRef = useRef<Map<string, string>>(new Map());

  useAssetMapBootstrap({
    editor,
    noteId,
    onDeleteAsset,
    isHydrating,
    assetKeyMapRef,
  });
  useAssetCleanupMutationHandlers({
    editor,
    onDeleteAsset,
    isHydrating,
    assetKeyMapRef,
  });

  return null;
}

function setAssetKeyIfPresent(
  assetKeyMap: Map<string, string>,
  nodeKey: string,
  assetId: string | null | undefined,
): void {
  if (isDefinedAssetId(assetId)) {
    assetKeyMap.set(nodeKey, assetId);
  }
}

function cacheNodeAssetId(
  assetKeyMap: Map<string, string>,
  node: ImageNode | AttachmentNode,
): void {
  setAssetKeyIfPresent(assetKeyMap, node.getKey(), node.getAssetId());
}

function readAndCacheAssetNodes(editor: LexicalEditor, assetKeyMap: Map<string, string>): void {
  editor.getEditorState().read(() => {
    $nodesOfType(ImageNode).forEach((node: ImageNode) => cacheNodeAssetId(assetKeyMap, node));
    $nodesOfType(AttachmentNode).forEach((node: AttachmentNode) =>
      cacheNodeAssetId(assetKeyMap, node),
    );
  });
}

function updateAssetMapForNodeKey(
  editor: LexicalEditor,
  nodeKey: string,
  assetKeyMap: Map<string, string>,
): void {
  editor.getEditorState().read(() => {
    const node = $getNodeByKey(nodeKey);
    if (node === null) return;
    if ($isImageNode(node) || $isAttachmentNode(node)) {
      cacheNodeAssetId(assetKeyMap, node);
    }
  });
}

function createMutationHandler({
  editor,
  isHydrating,
  onDeleteAsset,
  assetKeyMap,
}: {
  editor: LexicalEditor;
  isHydrating: boolean;
  onDeleteAsset: (assetId: string) => Promise<boolean>;
  assetKeyMap: Map<string, string>;
}): (mutations: Map<string, 'created' | 'destroyed' | 'updated'>) => void {
  return (mutations) => {
    if (isHydrating) return;
    mutations.forEach((mutation, nodeKey) => {
      if (mutation === 'created') {
        updateAssetMapForNodeKey(editor, nodeKey, assetKeyMap);
      } else if (mutation === 'destroyed') {
        const assetId = assetKeyMap.get(nodeKey);
        if (!isDefinedAssetId(assetId)) return;
        assetKeyMap.delete(nodeKey);
        void onDeleteAsset(assetId);
      }
    });
  };
}

function useAssetMapBootstrap({
  editor,
  noteId,
  onDeleteAsset,
  isHydrating,
  assetKeyMapRef,
}: {
  editor: LexicalEditor;
  noteId: string | null | undefined;
  onDeleteAsset: ((assetId: string) => Promise<boolean>) | undefined;
  isHydrating: boolean;
  assetKeyMapRef: MutableRefObject<Map<string, string>>;
}): void {
  useEffect(() => {
    assetKeyMapRef.current.clear();
    if (onDeleteAsset === undefined || isHydrating) return;
    readAndCacheAssetNodes(editor, assetKeyMapRef.current);
  }, [editor, isHydrating, noteId, onDeleteAsset]);
}

function useAssetCleanupMutationHandlers({
  editor,
  onDeleteAsset,
  isHydrating,
  assetKeyMapRef,
}: {
  editor: LexicalEditor;
  onDeleteAsset: ((assetId: string) => Promise<boolean>) | undefined;
  isHydrating: boolean;
  assetKeyMapRef: MutableRefObject<Map<string, string>>;
}): void {
  useEffect(() => {
    if (onDeleteAsset === undefined) return;
    const handleMutations = createMutationHandler({
      editor,
      isHydrating,
      onDeleteAsset,
      assetKeyMap: assetKeyMapRef.current,
    });

    return mergeRegister(
      editor.registerMutationListener(ImageNode, handleMutations),
      editor.registerMutationListener(AttachmentNode, handleMutations),
    );
  }, [editor, isHydrating, onDeleteAsset]);
}
