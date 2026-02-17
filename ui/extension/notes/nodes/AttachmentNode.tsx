import type { LexicalNode, NodeKey } from 'lexical';
import { DecoratorNode } from 'lexical';

export type SerializedAttachmentNode = {
  type: 'attachment';
  version: 1;
  href: string;
  fileName: string;
  mimeType?: string | null;
  assetId?: string | null;
};

interface AttachmentNodeParams {
  href: string;
  fileName: string;
  mimeType?: string | null | undefined;
  assetId?: string | null | undefined;
}

function PaperclipIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19" />
    </svg>
  );
}

export class AttachmentNode extends DecoratorNode<JSX.Element> {
  __href: string;
  __fileName: string;
  __mimeType: string | null;
  __assetId: string | null;

  static override getType(): string {
    return 'attachment';
  }

  static override clone(node: AttachmentNode): AttachmentNode {
    return new AttachmentNode(
      {
        href: node.__href,
        fileName: node.__fileName,
        mimeType: node.__mimeType,
        assetId: node.__assetId,
      },
      node.getKey(),
    );
  }

  static override importJSON(serializedNode: SerializedAttachmentNode): AttachmentNode {
    const { href, fileName, mimeType, assetId } = serializedNode;
    return new AttachmentNode({ href, fileName, mimeType, assetId });
  }

  constructor(params: AttachmentNodeParams, key?: NodeKey) {
    super(key);
    this.__href = params.href;
    this.__fileName = params.fileName;
    this.__mimeType = params.mimeType ?? null;
    this.__assetId = params.assetId ?? null;
  }

  getAssetId(): string | null {
    return this.__assetId;
  }

  override exportJSON(): SerializedAttachmentNode {
    return {
      type: 'attachment',
      version: 1,
      href: this.__href,
      fileName: this.__fileName,
      mimeType: this.__mimeType,
      assetId: this.__assetId,
    };
  }

  override createDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'lockin-note-attachment-wrapper';
    return container;
  }

  override updateDOM(): false {
    return false;
  }

  override decorate(): JSX.Element {
    const resolvedFileName = this.__fileName.length > 0 ? this.__fileName : 'Attachment';
    const hasMimeType =
      this.__mimeType !== null && this.__mimeType !== undefined && this.__mimeType.length > 0;

    return (
      <a
        href={this.__href}
        target="_blank"
        rel="noreferrer"
        className="lockin-note-attachment-chip"
      >
        <span className="lockin-note-attachment-chip-icon">
          <PaperclipIcon />
        </span>
        <span className="lockin-note-attachment-name">{resolvedFileName}</span>
        {hasMimeType ? (
          <span className="lockin-note-attachment-meta">{this.__mimeType}</span>
        ) : null}
      </a>
    );
  }
}

export function $createAttachmentNode(params: {
  href: string;
  fileName: string;
  mimeType?: string | null;
  assetId?: string | null;
}): AttachmentNode {
  return new AttachmentNode(params);
}

export function $isAttachmentNode(node: LexicalNode | null | undefined): node is AttachmentNode {
  return node instanceof AttachmentNode;
}
