import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Dispatch,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react';
import type { LexicalEditor, LexicalNode, NodeKey } from 'lexical';
import { $getNodeByKey } from 'lexical';
import {
  buildInitialDimensions,
  calculateAspectRatio,
  clamp,
  DEFAULT_WIDTH,
  getMaxWidth,
  getWidthDelta,
  hasPersistedDimensions,
  MAX_WIDTH,
  MIN_WIDTH,
  type ImageDimensions,
  type ResizeHandle,
} from './imageNodeResizeUtils';

interface ImageNodeMutator {
  setWidth: (value: number | null) => void;
  setHeight: (value: number | null) => void;
}

interface ResizeSnapshot {
  startX: number;
  startY: number;
  startWidth: number;
  aspectRatio: number;
  maxWidth: number;
}

function isImageNodeMutator(
  node: LexicalNode | null | undefined,
): node is LexicalNode & ImageNodeMutator {
  if (node === null || node === undefined || node.getType() !== 'image') {
    return false;
  }
  const candidate = node as unknown as Record<string, unknown>;
  return (
    typeof candidate['setWidth'] === 'function' && typeof candidate['setHeight'] === 'function'
  );
}

export function persistImageNodeDimensions(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  width: number,
  height: number,
): void {
  editor.update(() => {
    const node = $getNodeByKey(nodeKey);
    if (!isImageNodeMutator(node)) {
      return;
    }
    node.setWidth(width);
    node.setHeight(height);
  });
}

function usePropDimensionsSync({
  width,
  height,
  setDimensions,
}: {
  width: number | null | undefined;
  height: number | null | undefined;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
}): void {
  useEffect(() => {
    if (!hasPersistedDimensions(width, height)) {
      return;
    }
    setDimensions((prev) => ({
      ...prev,
      width: width as number,
      height: height as number,
      aspectRatio: calculateAspectRatio(width as number, height as number),
    }));
  }, [height, setDimensions, width]);
}

function useResponsiveMaxWidth({
  editor,
  setDimensions,
}: {
  editor: LexicalEditor;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
}): void {
  useEffect(() => {
    const updateMaxWidth = (): void => {
      const maxWidth = getMaxWidth(editor);
      setDimensions((prev) => {
        const width = clamp(prev.width, MIN_WIDTH, maxWidth);
        return { ...prev, maxWidth, width, height: width / prev.aspectRatio };
      });
    };
    updateMaxWidth();
    window.addEventListener('resize', updateMaxWidth);
    return () => window.removeEventListener('resize', updateMaxWidth);
  }, [editor, setDimensions]);
}

function useImageLoadHandler({
  editor,
  imageRef,
  nodeKey,
  width,
  height,
  setDimensions,
}: {
  editor: LexicalEditor;
  imageRef: MutableRefObject<HTMLImageElement | null>;
  nodeKey: NodeKey;
  width: number | null | undefined;
  height: number | null | undefined;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
}): () => void {
  return useCallback(() => {
    const image = imageRef.current;
    if (image === null) {
      return;
    }
    const aspectRatio = calculateAspectRatio(image.naturalWidth, image.naturalHeight);
    const maxWidth = getMaxWidth(editor);
    const nextWidth = width ?? clamp(Math.min(image.naturalWidth, maxWidth), MIN_WIDTH, maxWidth);
    const nextHeight = height ?? nextWidth / aspectRatio;
    setDimensions({ width: nextWidth, height: nextHeight, aspectRatio, maxWidth });

    if (!hasPersistedDimensions(width, height)) {
      persistImageNodeDimensions(editor, nodeKey, nextWidth, nextHeight);
    }
  }, [editor, height, imageRef, nodeKey, setDimensions, width]);
}

function createPointerMoveHandler({
  handle,
  resizeRef,
  setDimensions,
}: {
  handle: ResizeHandle;
  resizeRef: MutableRefObject<ResizeSnapshot>;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
}): (event: PointerEvent) => void {
  return (moveEvent: PointerEvent): void => {
    const { startX, startY, startWidth, aspectRatio, maxWidth } = resizeRef.current;
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    const widthDelta = getWidthDelta(handle, deltaX, deltaY, aspectRatio);
    const width = clamp(startWidth + widthDelta, MIN_WIDTH, maxWidth);
    const height = width / aspectRatio;
    setDimensions((prev) => ({ ...prev, width, height }));
  };
}

function buildResizeSnapshot(
  event: ReactPointerEvent,
  dimensions: ImageDimensions,
  editor: LexicalEditor,
): ResizeSnapshot {
  return {
    startX: event.clientX,
    startY: event.clientY,
    startWidth: dimensions.width,
    aspectRatio: dimensions.aspectRatio,
    maxWidth: getMaxWidth(editor),
  };
}

function startResizeDrag({
  event,
  handle,
  dimensions,
  editor,
  resizeRef,
  setDimensions,
  setIsResizing,
  onCommitDimensions,
}: {
  event: ReactPointerEvent;
  handle: ResizeHandle;
  dimensions: ImageDimensions;
  editor: LexicalEditor;
  resizeRef: MutableRefObject<ResizeSnapshot>;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
  setIsResizing: Dispatch<SetStateAction<boolean>>;
  onCommitDimensions: (width: number, height: number) => void;
}): void {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();

  const target = event.target;
  const pointerId = event.pointerId;
  target.setPointerCapture(pointerId);
  resizeRef.current = buildResizeSnapshot(event, dimensions, editor);
  setIsResizing(true);

  const onPointerMove = createPointerMoveHandler({ handle, resizeRef, setDimensions });
  const onPointerEnd = (): void => {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerEnd);
    document.removeEventListener('pointercancel', onPointerEnd);
    setIsResizing(false);
    setDimensions((current) => {
      onCommitDimensions(current.width, current.height);
      return current;
    });
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerEnd);
  document.addEventListener('pointercancel', onPointerEnd);
}

export function useImageDimensions({
  editor,
  nodeKey,
  width,
  height,
}: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  width: number | null | undefined;
  height: number | null | undefined;
}): {
  imageRef: MutableRefObject<HTMLImageElement | null>;
  dimensions: ImageDimensions;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
  onImageLoad: () => void;
} {
  const imageRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions>(() =>
    buildInitialDimensions(width, height),
  );
  usePropDimensionsSync({ width, height, setDimensions });
  useResponsiveMaxWidth({ editor, setDimensions });
  const onImageLoad = useImageLoadHandler({
    editor,
    imageRef,
    nodeKey,
    width,
    height,
    setDimensions,
  });
  return { imageRef, dimensions, setDimensions, onImageLoad };
}

export function useResizeHandlers({
  editor,
  dimensions,
  onCommitDimensions,
  setDimensions,
}: {
  editor: LexicalEditor;
  dimensions: ImageDimensions;
  onCommitDimensions: (width: number, height: number) => void;
  setDimensions: Dispatch<SetStateAction<ImageDimensions>>;
}): {
  isResizing: boolean;
  onResizeStart: (event: ReactPointerEvent, handle: ResizeHandle) => void;
} {
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<ResizeSnapshot>({
    startX: 0,
    startY: 0,
    startWidth: DEFAULT_WIDTH,
    aspectRatio: 1,
    maxWidth: MAX_WIDTH,
  });

  const onResizeStart = useCallback(
    (event: ReactPointerEvent, handle: ResizeHandle) =>
      startResizeDrag({
        event,
        handle,
        dimensions,
        editor,
        resizeRef,
        setDimensions,
        setIsResizing,
        onCommitDimensions,
      }),
    [dimensions, editor, onCommitDimensions, setDimensions],
  );

  return { isResizing, onResizeStart };
}
