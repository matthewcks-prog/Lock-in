import type { LexicalNode, NodeKey } from 'lexical';
import { DecoratorNode } from 'lexical';
import { ResizableImage } from './ResizableImage';

export type SerializedImageNode = {
  type: 'image';
  version: 1;
  src: string;
  alt: string;
  assetId?: string | null;
  width?: number | null;
  height?: number | null;
};

interface ImageNodePayload {
  src: string;
  alt?: string;
  assetId?: string | null;
  width?: number | null;
  height?: number | null;
}

function toNullableNumber(value: number | null | undefined): number | null {
  return value ?? null;
}

function normalizePayload(payload: ImageNodePayload): Required<ImageNodePayload> {
  return {
    src: payload.src,
    alt: payload.alt ?? '',
    assetId: payload.assetId ?? null,
    width: toNullableNumber(payload.width),
    height: toNullableNumber(payload.height),
  };
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt: string;
  __assetId: string | null;
  __width: number | null;
  __height: number | null;

  static override getType(): string {
    return 'image';
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(
      {
        src: node.__src,
        alt: node.__alt,
        assetId: node.__assetId,
        width: node.__width,
        height: node.__height,
      },
      node.getKey(),
    );
  }

  static override importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src, alt, assetId, width = null, height = null } = serializedNode;
    const payload: ImageNodePayload = { src, alt, width, height };
    if (assetId !== undefined) {
      payload.assetId = assetId;
    }
    return new ImageNode(payload);
  }

  constructor(payload: ImageNodePayload, key?: NodeKey) {
    super(key);
    const normalized = normalizePayload(payload);
    this.__src = normalized.src;
    this.__alt = normalized.alt;
    this.__assetId = normalized.assetId;
    this.__width = normalized.width;
    this.__height = normalized.height;
  }

  getAssetId(): string | null {
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

  override exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      alt: this.__alt,
      assetId: this.__assetId,
      width: this.__width ?? null,
      height: this.__height ?? null,
    };
  }

  override createDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'lockin-image-wrapper';
    return wrapper;
  }

  override updateDOM(): false {
    return false;
  }

  override decorate(): JSX.Element {
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

export function $createImageNode(params: ImageNodePayload): ImageNode {
  return new ImageNode(params);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
