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

const MIN_IMAGE_INSERT_WIDTH = 220;
const INSERT_EDITOR_HORIZONTAL_PADDING = 24;
const MAX_IMAGE_INSERT_WIDTH = 640;

function ensureSelectionAndParagraph(): void {
  const selection = $getSelection();
  const root = $getRoot();
  if (selection === null || !$isRangeSelection(selection)) {
    root.selectEnd();
  }

  if (root.getChildren().length === 0) {
    const paragraph = $createParagraphNode();
    root.append(paragraph);
    paragraph.selectEnd();
  }
}

function getDefaultImageWidth(editor: LexicalEditor): number | null {
  const rootElement = editor.getRootElement();
  const containerWidth = rootElement?.parentElement?.getBoundingClientRect().width ?? null;
  if (
    typeof containerWidth !== 'number' ||
    !Number.isFinite(containerWidth) ||
    containerWidth <= 0
  ) {
    return null;
  }

  return Math.max(
    MIN_IMAGE_INSERT_WIDTH,
    Math.min(containerWidth - INSERT_EDITOR_HORIZONTAL_PADDING, MAX_IMAGE_INSERT_WIDTH),
  );
}

function resolveImageAltText(asset: NoteAsset): string {
  if (asset.fileName !== undefined && asset.fileName !== null && asset.fileName.length > 0) {
    return asset.fileName;
  }

  return asset.mimeType.length > 0 ? asset.mimeType : 'image';
}

function resolveAttachmentFileName(asset: NoteAsset): string {
  if (asset.fileName !== undefined && asset.fileName !== null && asset.fileName.length > 0) {
    return asset.fileName;
  }

  return 'attachment';
}

function isImageAsset(asset: NoteAsset): boolean {
  return asset.mimeType?.startsWith('image/') === true || asset.type === 'image';
}

export function insertAssetIntoEditor(editor: LexicalEditor, asset: NoteAsset): void {
  editor.update(() => {
    ensureSelectionAndParagraph();
    const defaultWidth = getDefaultImageWidth(editor);

    if (isImageAsset(asset)) {
      const node = $createImageNode({
        src: asset.url,
        alt: resolveImageAltText(asset),
        assetId: asset.id,
        width: defaultWidth,
      });
      $insertNodes([node]);
    } else {
      const node = $createAttachmentNode({
        assetId: asset.id,
        href: asset.url,
        fileName: resolveAttachmentFileName(asset),
        mimeType: asset.mimeType,
      });
      $insertNodes([node]);
    }
  });
}
