import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  LexicalEditor,
  LexicalNode,
  NodeKey,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";

export type SerializedImageNode = {
  type: "image";
  version: 1;
  src: string;
  alt: string;
  assetId?: string | null;
  width?: number | null;
  height?: number | null;
};

// Constants
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 80;
const MAX_WIDTH = 960;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMaxWidth(editor: LexicalEditor): number {
  const root = editor.getRootElement();
  const scrollContainer = root?.closest(
    ".lockin-note-editor-scroll"
  ) as HTMLElement | null;
  const container = scrollContainer ?? root?.parentElement;
  const measured = container?.getBoundingClientRect().width ?? 0;
  // Account for padding: 24px left + 24px right
  return measured > 0 ? clamp(measured - 48, MIN_WIDTH, MAX_WIDTH) : MAX_WIDTH;
}

/**
 * ResizableImage component for Lexical editor
 * Industry-standard resize behavior with corner handles only
 */
function ResizableImage({
  src,
  alt,
  nodeKey,
  assetId,
  width,
  height,
}: {
  src: string;
  alt: string;
  nodeKey: NodeKey;
  assetId?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Dimensions state
  const [dimensions, setDimensions] = useState({
    width: width ?? DEFAULT_WIDTH,
    height: height ?? DEFAULT_WIDTH,
    aspectRatio: 1,
    maxWidth: MAX_WIDTH,
  });
  const [isResizing, setIsResizing] = useState(false);

  // Ref for resize calculations (avoids stale closures)
  const resizeRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: 0,
    aspectRatio: 1,
    maxWidth: MAX_WIDTH,
  });

  // Sync with prop changes
  useEffect(() => {
    if (width != null && height != null) {
      setDimensions((prev) => ({
        ...prev,
        width,
        height,
        aspectRatio: width / height || 1,
      }));
    }
  }, [width, height]);

  // Recalculate max width on window resize
  useEffect(() => {
    const updateMaxWidth = () => {
      const maxWidth = getMaxWidth(editor);
      setDimensions((prev) => {
        const newWidth = clamp(prev.width, MIN_WIDTH, maxWidth);
        return {
          ...prev,
          maxWidth,
          width: newWidth,
          height: newWidth / prev.aspectRatio,
        };
      });
    };
    updateMaxWidth();
    window.addEventListener("resize", updateMaxWidth);
    return () => window.removeEventListener("resize", updateMaxWidth);
  }, [editor]);

  // Handle image load - set initial dimensions from natural size
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    const { naturalWidth, naturalHeight } = img;
    const aspectRatio = naturalWidth / naturalHeight || 1;
    const maxWidth = getMaxWidth(editor);

    // Use saved dimensions or calculate from natural size
    const targetWidth =
      width ?? clamp(Math.min(naturalWidth, maxWidth), MIN_WIDTH, maxWidth);
    const targetHeight = height ?? targetWidth / aspectRatio;

    setDimensions({
      width: targetWidth,
      height: targetHeight,
      aspectRatio,
      maxWidth,
    });

    // Persist if not already saved
    if (width == null || height == null) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidth(targetWidth);
          node.setHeight(targetHeight);
        }
      });
    }
  }, [editor, nodeKey, width, height]);

  // Commit dimensions to Lexical node
  const commitDimensions = useCallback(
    (w: number, h: number) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidth(w);
          node.setHeight(h);
        }
      });
    },
    [editor, nodeKey]
  );

  // Handle corner resize with pointer capture for smooth dragging
  const handleResizeStart = useCallback(
    (e: ReactPointerEvent, corner: string) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const maxWidth = getMaxWidth(editor);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: dimensions.width,
        aspectRatio: dimensions.aspectRatio,
        maxWidth,
      };
      setIsResizing(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const { startX, startY, startWidth, aspectRatio, maxWidth } =
          resizeRef.current;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // Calculate new width based on handle being dragged
        let widthDelta = 0;
        switch (corner) {
          // Corner handles (diagonal movement)
          case "se":
            widthDelta = Math.max(deltaX, deltaY * aspectRatio);
            break;
          case "sw":
            widthDelta = Math.max(-deltaX, deltaY * aspectRatio);
            break;
          case "ne":
            widthDelta = Math.max(deltaX, -deltaY * aspectRatio);
            break;
          case "nw":
            widthDelta = Math.max(-deltaX, -deltaY * aspectRatio);
            break;
          // Horizontal edge handles
          case "e":
            widthDelta = deltaX;
            break;
          case "w":
            widthDelta = -deltaX;
            break;
          // Vertical edge handles (convert Y to width via aspect ratio)
          case "s":
            widthDelta = deltaY * aspectRatio;
            break;
          case "n":
            widthDelta = -deltaY * aspectRatio;
            break;
        }

        const newWidth = clamp(startWidth + widthDelta, MIN_WIDTH, maxWidth);
        const newHeight = newWidth / aspectRatio;

        setDimensions((prev) => ({
          ...prev,
          width: newWidth,
          height: newHeight,
        }));
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId);
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        setIsResizing(false);

        // Get final dimensions from ref to avoid stale closure
        setDimensions((current) => {
          commitDimensions(current.width, current.height);
          return current;
        });
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [editor, dimensions.width, dimensions.aspectRatio, commitDimensions]
  );

  // Lexical command handlers for click and keyboard
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (containerRef.current?.contains(event.target as HTMLElement)) {
            const target = event.target as HTMLElement;
            if (target.dataset.resizeHandle) return false;

            if (event.shiftKey) {
              setSelected(!isSelected);
            } else {
              clearSelection();
              setSelected(true);
            }
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        (e) => {
          if (isSelected) {
            e?.preventDefault();
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isImageNode(node)) node.remove();
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (e) => {
          if (isSelected) {
            e?.preventDefault();
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isImageNode(node)) node.remove();
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, isSelected, nodeKey, setSelected, clearSelection]);

  const containerClass = [
    "lockin-image-container",
    isSelected && "is-selected",
    isResizing && "is-resizing",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={{ width: dimensions.width }}
      role="figure"
      aria-label={alt || "Image"}
      data-asset-id={assetId ?? undefined}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="lockin-image"
        draggable={false}
        onLoad={handleImageLoad}
      />

      {/* Resize handles - only show when selected */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            className="lockin-resize-handle corner nw"
            data-resize-handle="nw"
            onPointerDown={(e) => handleResizeStart(e, "nw")}
          />
          <div
            className="lockin-resize-handle corner ne"
            data-resize-handle="ne"
            onPointerDown={(e) => handleResizeStart(e, "ne")}
          />
          <div
            className="lockin-resize-handle corner sw"
            data-resize-handle="sw"
            onPointerDown={(e) => handleResizeStart(e, "sw")}
          />
          <div
            className="lockin-resize-handle corner se"
            data-resize-handle="se"
            onPointerDown={(e) => handleResizeStart(e, "se")}
          />
          {/* Edge handles */}
          <div
            className="lockin-resize-handle edge n"
            data-resize-handle="n"
            onPointerDown={(e) => handleResizeStart(e, "n")}
          />
          <div
            className="lockin-resize-handle edge s"
            data-resize-handle="s"
            onPointerDown={(e) => handleResizeStart(e, "s")}
          />
          <div
            className="lockin-resize-handle edge e"
            data-resize-handle="e"
            onPointerDown={(e) => handleResizeStart(e, "e")}
          />
          <div
            className="lockin-resize-handle edge w"
            data-resize-handle="w"
            onPointerDown={(e) => handleResizeStart(e, "w")}
          />
        </>
      )}
    </div>
  );
}

// --- Lexical Node Class ---

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt: string;
  __assetId?: string | null;
  __width?: number | null;
  __height?: number | null;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__alt,
      node.__assetId,
      node.__width,
      node.__height,
      node.getKey()
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src, alt, assetId, width = null, height = null } = serializedNode;
    return new ImageNode(src, alt, assetId, width, height);
  }

  constructor(
    src: string,
    alt = "",
    assetId?: string | null,
    width?: number | null,
    height?: number | null,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__assetId = assetId;
    this.__width = width ?? null;
    this.__height = height ?? null;
  }

  getAssetId(): string | null | undefined {
    return this.__assetId;
  }

  getWidth(): number | null {
    return this.__width ?? null;
  }

  setWidth(width: number | null): void {
    const self = this.getWritable();
    self.__width = width;
  }

  setHeight(height: number | null): void {
    const self = this.getWritable();
    self.__height = height;
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      alt: this.__alt,
      assetId: this.__assetId,
      width: this.__width ?? null,
      height: this.__height ?? null,
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "lockin-image-wrapper";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <ResizableImage
        src={this.__src}
        alt={this.__alt}
        assetId={this.__assetId}
        nodeKey={this.getKey()}
        width={this.__width}
        height={this.__height}
      />
    );
  }
}

export function $createImageNode(params: {
  src: string;
  alt?: string;
  assetId?: string | null;
  width?: number | null;
  height?: number | null;
}): ImageNode {
  return new ImageNode(
    params.src,
    params.alt ?? "",
    params.assetId ?? null,
    params.width ?? null,
    params.height ?? null
  );
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}
