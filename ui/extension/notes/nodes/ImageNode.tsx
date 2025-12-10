import { useCallback, useEffect, useRef, useState } from "react";
import {
  $getNodeByKey,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  LexicalNode,
  NodeKey,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/LexicalNodeSelection";
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | null>(width ?? null);
  const latestWidthRef = useRef<number | null>(width ?? null);

  useEffect(() => {
    setCurrentWidth(width ?? null);
    latestWidthRef.current = width ?? null;
  }, [width]);

  const commitSize = useCallback(
    (nextWidth: number | null) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidth(nextWidth);
          node.setHeight(height ?? null);
        }
      });
    },
    [editor, height, nodeKey]
  );

  const handleResizeStart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const rect = imageRef.current?.getBoundingClientRect();
    const startWidth = rect?.width ?? currentWidth ?? 320;
    const parentWidth =
      wrapperRef.current?.parentElement?.getBoundingClientRect().width ?? startWidth;
    const maxWidth = Math.max(200, parentWidth - 16);
    const minWidth = 120;
    setIsResizing(true);

    const handleMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = clamp(startWidth + delta, minWidth, maxWidth);
      setCurrentWidth(next);
      latestWidthRef.current = next;
    };

    const handleUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault();
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      setIsResizing(false);
      commitSize(latestWidthRef.current ?? null);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const onClick = (event: React.MouseEvent) => {
    if (event.target === imageRef.current) {
      if (!event.shiftKey) {
        clearSelection();
      }
      setSelected(!isSelected);
    }
  };

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        (commandEvent: KeyboardEvent | null) => {
          if (isSelected) {
            commandEvent?.preventDefault();
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isImageNode(node)) {
                node.remove();
              }
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (commandEvent: KeyboardEvent | null) => {
          if (isSelected) {
            commandEvent?.preventDefault();
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isImageNode(node)) {
                node.remove();
              }
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, isSelected, nodeKey]);

  return (
    <div
      ref={wrapperRef}
      className={`lockin-note-image-shell${isSelected ? " is-selected" : ""}${
        isResizing ? " is-resizing" : ""
      }`}
      onClick={onClick}
      role="figure"
      aria-label={alt || "Image attachment"}
      data-asset-id={assetId || undefined}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="lockin-note-image-node"
        style={{
          width: currentWidth ? `${currentWidth}px` : "100%",
          maxWidth: "100%",
          height: height ? `${height}px` : "auto",
        }}
      />
      {isSelected ? (
        <button
          type="button"
          className="lockin-image-resize-handle"
          aria-label="Resize image"
          onMouseDown={handleResizeStart}
        />
      ) : null}
    </div>
  );
}

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
    span.className = "lockin-note-image-wrapper";
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

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
