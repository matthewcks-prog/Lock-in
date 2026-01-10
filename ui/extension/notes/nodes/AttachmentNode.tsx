import { DecoratorNode, LexicalNode, NodeKey } from 'lexical';

export type SerializedAttachmentNode = {
  type: 'attachment';
  version: 1;
  href: string;
  fileName: string;
  mimeType?: string | null;
  assetId?: string | null;
};

function PaperclipIcon() {
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
  __mimeType?: string | null;
  __assetId?: string | null;

  static getType(): string {
    return 'attachment';
  }

  static clone(node: AttachmentNode): AttachmentNode {
    return new AttachmentNode(
      node.__href,
      node.__fileName,
      node.__mimeType,
      node.__assetId,
      node.getKey(),
    );
  }

  static importJSON(serializedNode: SerializedAttachmentNode): AttachmentNode {
    const { href, fileName, mimeType, assetId } = serializedNode;
    return new AttachmentNode(href, fileName, mimeType, assetId);
  }

  constructor(
    href: string,
    fileName: string,
    mimeType?: string | null,
    assetId?: string | null,
    key?: NodeKey,
  ) {
    super(key);
    this.__href = href;
    this.__fileName = fileName;
    this.__mimeType = mimeType;
    this.__assetId = assetId;
  }

  getAssetId(): string | null | undefined {
    return this.__assetId;
  }

  exportJSON(): SerializedAttachmentNode {
    return {
      type: 'attachment',
      version: 1,
      href: this.__href,
      fileName: this.__fileName,
      mimeType: this.__mimeType,
      assetId: this.__assetId,
    };
  }

  createDOM(): HTMLElement {
    const container = document.createElement('span');
    container.className = 'lockin-note-attachment-wrapper';
    return container;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
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
        <span className="lockin-note-attachment-name">{this.__fileName || 'Attachment'}</span>
        {this.__mimeType ? (
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
  return new AttachmentNode(params.href, params.fileName, params.mimeType, params.assetId ?? null);
}

export function $isAttachmentNode(node: LexicalNode | null | undefined): node is AttachmentNode {
  return node instanceof AttachmentNode;
}
