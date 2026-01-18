import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, $nodesOfType } from 'lexical';
import { AttachmentNode, $isAttachmentNode } from '../../nodes/AttachmentNode';
import { ImageNode, $isImageNode } from '../../nodes/ImageNode';

export function AssetCleanupPlugin({
  noteId,
  onDeleteAsset,
  isHydrating,
}: {
  noteId: string | null | undefined;
  onDeleteAsset?: (assetId: string) => Promise<boolean>;
  isHydrating: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const assetKeyMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    assetKeyMapRef.current.clear();
    if (!onDeleteAsset || isHydrating) return;

    editor.getEditorState().read(() => {
      $nodesOfType(ImageNode).forEach((node: ImageNode) => {
        const assetId = node.getAssetId();
        if (assetId) {
          assetKeyMapRef.current.set(node.getKey(), assetId);
        }
      });
      $nodesOfType(AttachmentNode).forEach((node: AttachmentNode) => {
        const assetId = node.getAssetId();
        if (assetId) {
          assetKeyMapRef.current.set(node.getKey(), assetId);
        }
      });
    });
  }, [editor, isHydrating, noteId, onDeleteAsset]);

  useEffect(() => {
    if (!onDeleteAsset) return;

    const handleMutations = (mutations: Map<string, 'created' | 'destroyed' | 'updated'>) => {
      if (isHydrating) return;
      mutations.forEach((mutation, nodeKey) => {
        if (mutation === 'created') {
          editor.getEditorState().read(() => {
            const node = $getNodeByKey(nodeKey);
            if (!node) return;
            if ($isImageNode(node) || $isAttachmentNode(node)) {
              const assetId = (node as any).getAssetId?.();
              if (assetId) {
                assetKeyMapRef.current.set(nodeKey, assetId);
              }
            }
          });
        } else if (mutation === 'destroyed') {
          const assetId = assetKeyMapRef.current.get(nodeKey);
          if (assetId) {
            assetKeyMapRef.current.delete(nodeKey);
            void onDeleteAsset(assetId);
          }
        }
      });
    };

    return mergeRegister(
      editor.registerMutationListener(ImageNode, handleMutations),
      editor.registerMutationListener(AttachmentNode, handleMutations),
    );
  }, [editor, isHydrating, onDeleteAsset]);

  return null;
}
