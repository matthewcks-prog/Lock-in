import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeNode, CodeHighlightNode, INSERT_CODE_BLOCK_COMMAND } from "@lexical/code";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  $isListNode,
} from "@lexical/list";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { HeadingNode, QuoteNode, $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin as ReactLinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateNodesFromDOM } from "@lexical/html";
import { $insertNodes, mergeRegister, $nodesOfType } from "@lexical/utils";
import { $patchStyleText, $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  LexicalEditor,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  $getNodeByKey,
  EditorState,
} from "lexical";
import type { Note, NoteAsset, NoteContent, NoteStatus } from "../../core/domain/Note.ts";
import { AttachmentNode, $createAttachmentNode, $isAttachmentNode } from "./nodes/AttachmentNode";
import { ImageNode, $createImageNode, $isImageNode } from "./nodes/ImageNode";

interface NoteEditorShellProps {
  note: Note | null;
  status: NoteStatus;
  title: string;
  onTitleChange: (next: string) => void;
  onContentChange: (content: NoteContent) => void;
  onSaveNow?: () => void;
  onUploadFile?: (file: File) => Promise<NoteAsset | null>;
  onDeleteAsset?: (assetId: string) => Promise<boolean>;
  isAssetUploading?: boolean;
  assetError?: string | null;
  editorError?: string | null;
}

type BlockType = "paragraph" | "h1" | "h2" | "h3";

const BLOCK_OPTIONS: Array<{ value: BlockType; label: string }> = [
  { value: "paragraph", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
];

const TEXT_COLORS = ["#111827", "#334155", "#2563eb", "#7c3aed", "#dc2626", "#059669", "#f59e0b"];
const HIGHLIGHT_COLORS = ["#fef3c7", "#e0f2fe", "#f3e8ff", "#dcfce7", "#fee2e2", "transparent"];

function PaperclipIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
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

const theme = {
  paragraph: "lockin-note-paragraph",
  text: {
    bold: "lockin-note-text-bold",
    italic: "lockin-note-text-italic",
    underline: "lockin-note-text-underline",
    code: "lockin-note-text-code",
  },
  heading: {
    h1: "lockin-note-heading-h1",
    h2: "lockin-note-heading-h2",
    h3: "lockin-note-heading-h3",
  },
  list: {
    ul: "lockin-note-list",
    listitem: "lockin-note-list-item",
    listitemChecked: "lockin-note-list-item-checked",
    listitemUnchecked: "lockin-note-list-item-unchecked",
    olDepth: ["lockin-note-list-ol-depth-1", "lockin-note-list-ol-depth-2"],
    ulDepth: ["lockin-note-list-ul-depth-1", "lockin-note-list-ul-depth-2"],
  },
  code: "lockin-note-code",
  link: "lockin-note-link",
  quote: "lockin-note-quote",
};

function relativeLabel(iso: string | null | undefined) {
  if (!iso) return "just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function NoteContentLoader({
  note,
  onHydrationChange,
}: {
  note: Note | null;
  onHydrationChange?: (hydrating: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onHydrationChange?.(true);

    const finish = () => {
      window.setTimeout(() => onHydrationChange?.(false), 0);
    };

    if (!note) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      });
      finish();
      return;
    }

    const loadLexicalState = () => {
      const { content } = note;
      if (content.version === "lexical_v1" && content.editorState) {
        try {
          const state = editor.parseEditorState(content.editorState as any);
          editor.setEditorState(state);
          finish();
          return;
        } catch {
          // fall through to legacy loader
        }
      }

      if (content.legacyHtml) {
        try {
          const parser = new DOMParser();
          const dom = parser.parseFromString(content.legacyHtml, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            root.append(...nodes);
          });
          finish();
          return;
        } catch {
          // ignore
        }
      }

      editor.update(() => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      });
      finish();
    };

    loadLexicalState();
  }, [editor, note, onHydrationChange]);

  return null;
}

function NoteChangePlugin({ onChange }: { onChange: (content: NoteContent) => void }) {
  return (
    <OnChangePlugin
      onChange={(editorState: EditorState) => {
        const plainText = editorState.read(() => $getRoot().getTextContent());
        onChange({
          version: "lexical_v1",
          editorState: editorState.toJSON(),
          plainText,
        });
      }}
    />
  );
}

function ShortcutsPlugin({ onSaveNow }: { onSaveNow?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          onSaveNow?.();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onSaveNow]);

  return null;
}

function insertAssetIntoEditor(editor: LexicalEditor, asset: NoteAsset) {
  editor.update(() => {
    const selection = $getSelection();
    const root = $getRoot();
    if (!selection || !$isRangeSelection(selection)) {
      root.selectEnd();
    }

    const rootElement = editor.getRootElement();
    const containerWidth = rootElement?.parentElement?.getBoundingClientRect().width ?? null;
    const defaultWidth = containerWidth ? Math.max(220, Math.min(containerWidth - 24, 640)) : null;

    if (asset.mimeType?.startsWith("image/") || asset.type === "image") {
      const node = $createImageNode({
        src: asset.url,
        alt: asset.fileName || asset.mimeType || "image",
        assetId: asset.id,
        width: defaultWidth,
      });
      $insertNodes([node]);
    } else {
      const node = $createAttachmentNode({
        assetId: asset.id,
        href: asset.url,
        fileName: asset.fileName || "attachment",
        mimeType: asset.mimeType,
      });
      $insertNodes([node]);
    }
  });
}

function UploadPlugin({
  onUploadFile,
  onEditorReady,
}: {
  onUploadFile?: (file: File) => Promise<NoteAsset | null>;
  onEditorReady?: (editor: LexicalEditor) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!onUploadFile || !files || files.length === 0) return;
      const file = files[0];
      const asset = await onUploadFile(file);
      if (!asset) return;
      insertAssetIntoEditor(editor, asset);
    },
    [editor, onUploadFile]
  );

  useEffect(() => {
    if (!onUploadFile) return;
    const listener = (event: ClipboardEvent | DragEvent) => {
      const files =
        event instanceof ClipboardEvent
          ? event.clipboardData?.files
          : event instanceof DragEvent
          ? event.dataTransfer?.files
          : null;
      if (!files || files.length === 0) return;
      event.preventDefault();
      void handleFiles(files);
    };

    const rootElement = editor.getRootElement();
    if (!rootElement) return;
    rootElement.addEventListener("paste", listener);
    rootElement.addEventListener("drop", listener);
    return () => {
      rootElement.removeEventListener("paste", listener);
      rootElement.removeEventListener("drop", listener);
    };
  }, [editor, handleFiles, onUploadFile]);

  return null;
}

function AssetCleanupPlugin({
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

    const handleMutations = (mutations: Map<string, "created" | "destroyed" | "updated">) => {
      if (isHydrating) return;
      mutations.forEach((mutation, nodeKey) => {
        if (mutation === "created") {
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
        } else if (mutation === "destroyed") {
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
      editor.registerMutationListener(AttachmentNode, handleMutations)
    );
  }, [editor, isHydrating, onDeleteAsset]);

  return null;
}

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`lockin-note-tool-btn${active ? " is-active" : ""}`}
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children || label}
    </button>
  );
}

function BlockTypeSelect({
  value,
  onChange,
}: {
  value: BlockType;
  onChange: (next: BlockType) => void;
}) {
  return (
    <select
      className="lockin-note-block-select"
      value={value}
      onChange={(event) => onChange(event.target.value as BlockType)}
      aria-label="Block type"
    >
      {BLOCK_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SwatchMenu({
  swatches,
  onSelect,
  label,
}: {
  swatches: string[];
  onSelect: (color: string) => void;
  label: string;
}) {
  return (
    <div className="lockin-note-color-menu" role="listbox" aria-label={label}>
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          className="lockin-color-swatch"
          style={{ background: color === "transparent" ? "white" : color }}
          onClick={() => onSelect(color)}
          aria-label={`${label} ${color}`}
        />
      ))}
    </div>
  );
}

function NoteToolbar({
  onOpenFilePicker,
  disableAttachment,
  isUploading,
}: {
  onOpenFilePicker?: () => void;
  disableAttachment?: boolean;
  isUploading?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockTypeState] = useState<BlockType>("paragraph");
  const [selectionFormats, setSelectionFormats] = useState<Set<string>>(new Set());
  const [alignment, setAlignment] = useState<string>("left");
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();

      const formats = new Set<string>();
      if (selection.hasFormat("bold")) formats.add("bold");
      if (selection.hasFormat("italic")) formats.add("italic");
      if (selection.hasFormat("underline")) formats.add("underline");
      if (selection.hasFormat("code")) formats.add("code");
      setSelectionFormats(formats);

      if ($isHeadingNode(element)) {
        setBlockTypeState(element.getTag() as BlockType);
      } else if ($isListNode(element)) {
        setBlockTypeState("paragraph");
      } else {
        const type = element.getType();
        setBlockTypeState(type === "paragraph" ? "paragraph" : "paragraph");
      }

      const formatType = element.getFormatType ? element.getFormatType() : "left";
      setAlignment(formatType || "left");
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }: { editorState: EditorState }) => {
        editorState.read(() => updateToolbar());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, updateToolbar]);

  const applyStyle = useCallback(
    (style: Record<string, string>) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, style);
        }
      });
    },
    [editor]
  );

  const handleBlockChange = (next: BlockType) => {
    setBlockTypeState(next);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (next === "paragraph") {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(next));
        }
      }
    });
  };

  const toggleLink = useCallback(() => {
    const url = window.prompt("Enter URL");
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor]);

  return (
    <div className="lockin-note-toolbar">
      <div className="lockin-note-toolbar-group">
        <BlockTypeSelect value={blockType} onChange={handleBlockChange} />
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Bold"
          active={selectionFormats.has("bold")}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={selectionFormats.has("italic")}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={selectionFormats.has("underline")}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        >
          U
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={selectionFormats.has("code")}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
        >
          {"</>"}
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={toggleLink}>
          Link
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group lockin-note-toolbar-menu">
        <ToolbarButton label="Text color" onClick={() => setShowColor((v) => !v)}>
          Color
        </ToolbarButton>
        {showColor ? (
          <SwatchMenu
            label="Text color"
            swatches={TEXT_COLORS}
            onSelect={(color) => {
              applyStyle({ color });
              setShowColor(false);
            }}
          />
        ) : null}
        <ToolbarButton
          label="Highlight"
          onClick={() => setShowHighlight((v) => !v)}
        >
          Highlight
        </ToolbarButton>
        {showHighlight ? (
          <SwatchMenu
            label="Highlight"
            swatches={HIGHLIGHT_COLORS}
            onSelect={(color) => {
              if (color === "transparent") {
                applyStyle({ "background-color": "transparent" });
              } else {
                applyStyle({ "background-color": color });
              }
              setShowHighlight(false);
            }}
          />
        ) : null}
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Bulleted list"
          onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        >
          Bul
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          onClick={() => editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, undefined)}
        >
          {"{}"}
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Align left"
          active={alignment === "left" || alignment === "start"}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
        >
          L
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={alignment === "center"}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
        >
          C
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={alignment === "right" || alignment === "end"}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
        >
          R
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Attach file"
          onClick={onOpenFilePicker}
          disabled={disableAttachment}
        >
          <PaperclipIcon />
        </ToolbarButton>
        {isUploading ? <span className="lockin-inline-spinner" aria-label="Uploading" /> : null}
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Undo"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        >
          Undo
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        >
          Redo
        </ToolbarButton>
      </div>
    </div>
  );
}

function buildStatusLabel({
  status,
  updatedAt,
  isAssetUploading,
  error,
}: {
  status: NoteStatus;
  updatedAt?: string | null;
  isAssetUploading?: boolean;
  error?: string | null;
}) {
  if (error) {
    return { label: error || "Error saving - retry soon", tone: "error" as const, spinner: false };
  }
  if (status === "error") {
    return { label: "Error saving - retry soon", tone: "error" as const, spinner: false };
  }
  if (status === "saving") {
    return { label: "Saving...", tone: "muted" as const, spinner: true };
  }
  if (isAssetUploading) {
    return { label: "Uploading attachment...", tone: "muted" as const, spinner: true };
  }
  if (status === "saved") {
    return { label: `Saved ${relativeLabel(updatedAt)}`, tone: "success" as const, spinner: false };
  }
  if (status === "editing") {
    return { label: "Editing...", tone: "muted" as const, spinner: false };
  }
  return { label: "Idle", tone: "muted" as const, spinner: false };
}

export function NoteEditorShell({
  note,
  status,
  title,
  onTitleChange,
  onContentChange,
  onSaveNow,
  onUploadFile,
  onDeleteAsset,
  isAssetUploading,
  assetError,
  editorError,
}: NoteEditorShellProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [composerEditor, setComposerEditor] = useState<LexicalEditor | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  const initialEditorState = useMemo(() => {
    if (!note?.content) return null;
    if (note.content.version === "lexical_v1" && note.content.editorState) {
      return note.content.editorState as any;
    }
    return null;
  }, [note]);

  const initialConfig: InitialConfigType = useMemo(
    () => ({
      namespace: "LockInNoteEditor",
      theme,
      editorState: initialEditorState as any,
      onError(error: Error) {
        console.error("Lexical editor error", error);
      },
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        LinkNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        ImageNode,
        AttachmentNode,
      ],
    }),
    [initialEditorState]
  );

  const statusMeta = buildStatusLabel({
    status,
    updatedAt: note?.updatedAt,
    isAssetUploading,
    error: assetError || editorError,
  });

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="lockin-note-shell-card">
      <div className="lockin-note-shell-head">
        <div className="lockin-note-title-row">
          <input
            className="lockin-note-title-input"
            value={title}
            placeholder="Note title..."
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <div className={`lockin-note-status is-${statusMeta.tone}`}>
            {statusMeta.spinner ? <span className="lockin-inline-spinner" aria-hidden="true" /> : null}
            <span>{statusMeta.label}</span>
          </div>
        </div>
      </div>

      <LexicalComposer initialConfig={initialConfig}>
        <div className="lockin-note-toolbar-wrapper">
          <NoteToolbar
            onOpenFilePicker={onUploadFile ? handleUploadClick : undefined}
            disableAttachment={!note?.id || !onUploadFile}
            isUploading={isAssetUploading}
          />
        </div>

        <div className="lockin-note-editor-surface">
          <div className="lockin-note-editor-scroll">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="lockin-note-editor-area"
                  data-placeholder="Write your note here..."
                />
              }
              placeholder={<div className="lockin-note-placeholder">Write your note here...</div>}
            />
          </div>
        </div>

        <HistoryPlugin />
        <ListPlugin />
        <ReactLinkPlugin />
        <AutoFocusPlugin />
        <NoteContentLoader note={note} onHydrationChange={setIsHydrating} />
        <NoteChangePlugin onChange={onContentChange} />
        <ShortcutsPlugin onSaveNow={onSaveNow} />
        <UploadPlugin onUploadFile={onUploadFile} onEditorReady={setComposerEditor} />
        <AssetCleanupPlugin
          noteId={note?.id}
          onDeleteAsset={onDeleteAsset}
          isHydrating={isHydrating}
        />
      </LexicalComposer>

      {assetError ? <div className="lockin-note-inline-error">{assetError}</div> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onUploadFile && composerEditor) {
            void onUploadFile(file).then((asset) => {
              if (asset) {
                insertAssetIntoEditor(composerEditor, asset);
              }
            });
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
      />
    </div>
  );
}

export const NoteEditor = NoteEditorShell;
