import { useCallback, useRef } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import type { NodeKey } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { type ResizeHandle } from './imageNodeResizeUtils';
import {
  persistImageNodeDimensions,
  useImageDimensions,
  useResizeHandlers,
} from './imageNodeResizeHooks';
import { useImageNodeSelectionCommands } from './imageNodeSelectionCommands';

interface ResizableImageProps {
  src: string;
  alt: string;
  nodeKey: NodeKey;
  assetId?: string | null;
  width?: number | null;
  height?: number | null;
}

interface ResizeHandlesProps {
  isVisible: boolean;
  onResizeStart: (event: ReactPointerEvent, handle: ResizeHandle) => void;
}

interface ResizableImageFigureProps {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  imageRef: MutableRefObject<HTMLImageElement | null>;
  src: string;
  alt: string;
  assetId: string | null | undefined;
  width: number;
  isSelected: boolean;
  isResizing: boolean;
  onImageLoad: () => void;
  onResizeStart: (event: ReactPointerEvent, handle: ResizeHandle) => void;
}

const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

function getContainerClassName(isSelected: boolean, isResizing: boolean): string {
  return ['lockin-image-container', isSelected && 'is-selected', isResizing && 'is-resizing']
    .filter(Boolean)
    .join(' ');
}

function getResizeHandleClassName(handle: ResizeHandle): string {
  const region = handle.length === 1 ? 'edge' : 'corner';
  return `lockin-resize-handle ${region} ${handle}`;
}

function ResizeHandles({ isVisible, onResizeStart }: ResizeHandlesProps): JSX.Element | null {
  if (!isVisible) {
    return null;
  }
  return (
    <>
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={getResizeHandleClassName(handle)}
          data-resize-handle={handle}
          onPointerDown={(event) => onResizeStart(event, handle)}
        />
      ))}
    </>
  );
}

function ResizableImageFigure({
  containerRef,
  imageRef,
  src,
  alt,
  assetId,
  width,
  isSelected,
  isResizing,
  onImageLoad,
  onResizeStart,
}: ResizableImageFigureProps): JSX.Element {
  return (
    <div
      ref={containerRef}
      className={getContainerClassName(isSelected, isResizing)}
      style={{ width }}
      role="figure"
      aria-label={alt.length > 0 ? alt : 'Image'}
      data-asset-id={assetId ?? undefined}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="lockin-image"
        draggable={false}
        onLoad={onImageLoad}
      />
      <ResizeHandles isVisible={isSelected} onResizeStart={onResizeStart} />
    </div>
  );
}

function useCommitDimensions(
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  nodeKey: NodeKey,
): (nextWidth: number, nextHeight: number) => void {
  return useCallback(
    (nextWidth: number, nextHeight: number) => {
      persistImageNodeDimensions(editor, nodeKey, nextWidth, nextHeight);
    },
    [editor, nodeKey],
  );
}

export function ResizableImage({
  src,
  alt,
  nodeKey,
  assetId,
  width,
  height,
}: ResizableImageProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const { imageRef, dimensions, setDimensions, onImageLoad } = useImageDimensions({
    editor,
    nodeKey,
    width,
    height,
  });
  const onCommitDimensions = useCommitDimensions(editor, nodeKey);
  const { isResizing, onResizeStart } = useResizeHandlers({
    editor,
    dimensions,
    onCommitDimensions,
    setDimensions,
  });

  useImageNodeSelectionCommands({
    editor,
    nodeKey,
    containerRef,
    isSelected,
    setSelected,
    clearSelection,
  });

  return (
    <ResizableImageFigure
      containerRef={containerRef}
      imageRef={imageRef}
      src={src}
      alt={alt}
      assetId={assetId}
      width={dimensions.width}
      isSelected={isSelected}
      isResizing={isResizing}
      onImageLoad={onImageLoad}
      onResizeStart={onResizeStart}
    />
  );
}
