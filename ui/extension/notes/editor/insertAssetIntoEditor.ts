import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import type { NoteAsset } from '@core/domain/Note';
import { $createAttachmentNode } from '../nodes/AttachmentNode';
import { $createImageNode } from '../nodes/ImageNode';

export function insertAssetIntoEditor(editor: LexicalEditor, asset: NoteAsset) {
  editor.update(() => {
    const selection = $getSelection();
    const root = $getRoot();

    // Ensure we have a valid selection, even in an empty editor
    if (!selection || !$isRangeSelection(selection)) {
      root.selectEnd();
    }

    // If root is empty, ensure we have at least one paragraph for the image to be inserted into
    const rootChildren = root.getChildren();
    if (rootChildren.length === 0) {
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      paragraph.selectEnd();
    }

    const rootElement = editor.getRootElement();
    const containerWidth = rootElement?.parentElement?.getBoundingClientRect().width ?? null;
    const defaultWidth = containerWidth ? Math.max(220, Math.min(containerWidth - 24, 640)) : null;

    if (asset.mimeType?.startsWith('image/') || asset.type === 'image') {
      const node = $createImageNode({
        src: asset.url,
        alt: asset.fileName || asset.mimeType || 'image',
        assetId: asset.id,
        width: defaultWidth,
      });
      $insertNodes([node]);
    } else {
      const node = $createAttachmentNode({
        assetId: asset.id,
        href: asset.url,
        fileName: asset.fileName || 'attachment',
        mimeType: asset.mimeType,
      });
      $insertNodes([node]);
    }
  });
}
