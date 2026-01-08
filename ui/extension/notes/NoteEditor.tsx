import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeNode, CodeHighlightNode, $createCodeNode } from '@lexical/code';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  Undo2,
  Redo2,
  Paperclip,
  Highlighter,
  Palette,
  Bold,
  Italic,
  Underline,
  Code,
  Link,
  List,
  ListOrdered,
  Braces,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  $isListNode,
} from '@lexical/list';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { HeadingNode, QuoteNode, $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin as ReactLinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateNodesFromDOM } from '@lexical/html';
import { mergeRegister } from '@lexical/utils';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $insertNodes,
  $nodesOfType,
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
  $isElementNode,
} from 'lexical';
import type { Note, NoteAsset, NoteContent, NoteStatus } from '@core/domain/Note';
import { AttachmentNode, $createAttachmentNode, $isAttachmentNode } from './nodes/AttachmentNode';
import { ImageNode, $createImageNode, $isImageNode } from './nodes/ImageNode';

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

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3';

const BLOCK_OPTIONS: Array<{ value: BlockType; label: string }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
];

const TEXT_COLORS = ['#111827', '#334155', '#2563eb', '#7c3aed', '#dc2626', '#059669', '#f59e0b'];
const HIGHLIGHT_COLORS = ['#fef3c7', '#e0f2fe', '#f3e8ff', '#dcfce7', '#fee2e2', 'transparent'];

const theme = {
  paragraph: 'lockin-note-paragraph',
  text: {
    bold: 'lockin-note-text-bold',
    italic: 'lockin-note-text-italic',
    underline: 'lockin-note-text-underline',
    code: 'lockin-note-text-code',
  },
  heading: {
    h1: 'lockin-note-heading-h1',
    h2: 'lockin-note-heading-h2',
    h3: 'lockin-note-heading-h3',
  },
  list: {
    ul: 'lockin-note-list',
    listitem: 'lockin-note-list-item',
    listitemChecked: 'lockin-note-list-item-checked',
    listitemUnchecked: 'lockin-note-list-item-unchecked',
    olDepth: ['lockin-note-list-ol-depth-1', 'lockin-note-list-ol-depth-2'],
    ulDepth: ['lockin-note-list-ul-depth-1', 'lockin-note-list-ul-depth-2'],
  },
  code: 'lockin-note-code',
  link: 'lockin-note-link',
  quote: 'lockin-note-quote',
};

function relativeLabel(iso: string | null | undefined) {
  if (!iso) return 'just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * NoteContentLoader handles:
 * 1. Initial hydration signaling (for asset cleanup timing)
 * 2. Legacy HTML migration for old notes that don't have lexical state
 *
 * Since LexicalComposer uses a `key` based on note.id, it remounts when
 * switching notes. The initialConfig.editorState handles loading the
 * Lexical state. This plugin only needs to handle the legacy HTML case.
 */
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

    // If we have Lexical state in initialConfig, it's already loaded by LexicalComposer
    // We only need to handle legacy HTML migration here
    if (!note || !note.content) {
      finish();
      return;
    }

    const { content } = note;

    // Already loaded via initialConfig.editorState
    if (content.version === 'lexical_v1' && content.editorState) {
      finish();
      return;
    }

    // Legacy HTML migration: convert old HTML-only notes to Lexical
    if (content.legacyHtml) {
      try {
        const parser = new DOMParser();
        const dom = parser.parseFromString(content.legacyHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          root.append(...nodes);
        });
      } catch {
        // On error, just leave editor with default paragraph from initialConfig
      }
    }

    finish();
  }, [editor, note, onHydrationChange]);

  return null;
}

function NoteChangePlugin({
  onChange,
  isHydrating,
}: {
  onChange: (content: NoteContent) => void;
  isHydrating: boolean;
}) {
  const isFirstChangeRef = useRef(true);

  // Reset on mount (when editor remounts for a new note)
  useEffect(() => {
    isFirstChangeRef.current = true;
  }, []);

  return (
    <OnChangePlugin
      ignoreSelectionChange={true}
      onChange={(editorState: EditorState) => {
        // Skip the initial change event that fires when the editor first loads
        // and skip changes during hydration to prevent save loops
        if (isFirstChangeRef.current) {
          isFirstChangeRef.current = false;
          if (isHydrating) {
            return;
          }
        }
        if (isHydrating) {
          return;
        }
        const plainText = editorState.read(() => $getRoot().getTextContent());
        onChange({
          version: 'lexical_v1',
          editorState: editorState.toJSON(),
          plainText,
        });
      }}
    />
  );
}

/**
 * CaretScrollPlugin: Smart scrolling that keeps the caret within a "comfort band"
 *
 * UX principles:
 * - Wide comfort band (15%-85%) so scrolling is rare during normal editing
 * - When scrolling IS needed, scroll minimally (just bring caret slightly inside the band)
 * - Use 'auto' for small/medium moves to avoid laggy feel; 'smooth' only for big jumps
 * - Respects prefers-reduced-motion
 * - Debounced with RAF to prevent jitter
 */
function CaretScrollPlugin({
  topRatio = 0.15,
  bottomRatio = 0.85,
  scrollCushion = 24,
  smoothThreshold = 150,
}: {
  /** Top boundary of comfort band (0-1, default 0.15 = 15% from top) */
  topRatio?: number;
  /** Bottom boundary of comfort band (0-1, default 0.85 = 85% from top) */
  bottomRatio?: number;
  /** Extra pixels to scroll past the band edge for breathing room */
  scrollCushion?: number;
  /** Scroll distance threshold above which to use smooth scrolling */
  smoothThreshold?: number;
}) {
  const [editor] = useLexicalComposerContext();
  const prefersReducedMotion = useRef(false);
  const lastScrollTime = useRef(0);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const scrollToCaret = () => {
      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      // Find the scroll container
      const scrollContainer = rootElement.closest(
        '.lockin-note-editor-scroll',
      ) as HTMLElement | null;
      if (!scrollContainer) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!range.collapsed) return; // Only scroll for caret, not text selections

      // Get caret position relative to viewport
      const caretRect = range.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // Skip if caret rect is invalid (can happen during DOM updates)
      if (caretRect.height === 0 && caretRect.width === 0) return;

      // Calculate the comfort band boundaries (in viewport coordinates)
      const containerHeight = containerRect.height;
      const topBand = containerRect.top + containerHeight * topRatio;
      const bottomBand = containerRect.top + containerHeight * bottomRatio;

      const caretY = caretRect.top;
      const caretBottom = caretRect.bottom;

      // Check if caret is within the comfort band
      if (caretY >= topBand && caretBottom <= bottomBand) {
        return; // Caret is comfortable, no scroll needed
      }

      // Calculate minimal scroll to bring caret just inside the band
      // We add a small cushion so user sees some context
      let scrollDelta = 0;

      if (caretY < topBand) {
        // Caret is above the band - scroll up
        // Scroll just enough to put caret at topBand + cushion
        scrollDelta = caretY - topBand - scrollCushion;
      } else if (caretBottom > bottomBand) {
        // Caret is below the band - scroll down
        // Scroll just enough to put caret bottom at bottomBand - cushion
        scrollDelta = caretBottom - bottomBand + scrollCushion;
      }

      // Ignore tiny scroll amounts (prevents micro-jitter)
      if (Math.abs(scrollDelta) < 4) return;

      // Throttle scrolls slightly to prevent rapid-fire during fast typing
      const now = Date.now();
      if (now - lastScrollTime.current < 50) return;
      lastScrollTime.current = now;

      // Determine scroll behavior:
      // - Always 'auto' if user prefers reduced motion
      // - 'auto' for small moves (feels snappier)
      // - 'smooth' only for larger jumps (feels intentional)
      const useSmooth = !prefersReducedMotion.current && Math.abs(scrollDelta) > smoothThreshold;

      scrollContainer.scrollBy({
        top: scrollDelta,
        behavior: useSmooth ? 'smooth' : 'auto',
      });
    };

    // Debounce with RAF to batch updates within a frame
    let rafId: number | null = null;
    const debouncedScroll = () => {
      if (rafId !== null) return; // Already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scrollToCaret();
      });
    };

    // Listen for selection changes (clicks, arrow keys, etc.)
    const unregister = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        debouncedScroll();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    // Handle keyboard input - check scroll after keystroke is processed
    const unregisterKey = editor.registerCommand(
      KEY_DOWN_COMMAND,
      () => {
        // Use setTimeout to check after the DOM update from the keystroke
        window.setTimeout(debouncedScroll, 0);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregister();
      unregisterKey();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [editor, topRatio, bottomRatio, scrollCushion, smoothThreshold]);

  return null;
}

function ShortcutsPlugin({ onSaveNow }: { onSaveNow?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          onSaveNow?.();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSaveNow]);

  return null;
}

function insertAssetIntoEditor(editor: LexicalEditor, asset: NoteAsset) {
  editor.update(() => {
    const selection = $getSelection();
    const root = $getRoot();

    // Ensure we have a valid selection, even in an empty editor
    if (!selection || !$isRangeSelection(selection)) {
      root.selectEnd();
    }

    // If root is empty, ensure we have at least one paragraph for the image to be inserted into
    // Lexical's $insertNodes will handle this automatically, but we ensure selection is valid
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
    [editor, onUploadFile],
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
    rootElement.addEventListener('paste', listener);
    rootElement.addEventListener('drop', listener);
    return () => {
      rootElement.removeEventListener('paste', listener);
      rootElement.removeEventListener('drop', listener);
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

    const handleMutations = (mutations: Map<string, 'created' | 'destroyed' | 'updated'>) => {
      if (isHydrating) return;
      mutations.forEach((mutation, nodeKey) => {
        if (mutation === 'created') {
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
        } else if (mutation === 'destroyed') {
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
      editor.registerMutationListener(AttachmentNode, handleMutations),
    );
  }, [editor, isHydrating, onDeleteAsset]);

  return null;
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="lockin-tooltip-wrapper">
      {children}
      <span className="lockin-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
  swatchColor,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  swatchColor?: string | null;
}) {
  return (
    <Tooltip text={label}>
      <button
        type="button"
        className={`lockin-note-tool-btn${active ? ' is-active' : ''}`}
        aria-pressed={active}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {children || label}
        {swatchColor && (
          <span
            className="lockin-tool-swatch"
            style={{
              background:
                swatchColor === 'transparent'
                  ? 'linear-gradient(135deg, #fff 45%, #f00 50%, #fff 55%)'
                  : swatchColor,
            }}
          />
        )}
      </button>
    </Tooltip>
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
          style={{ background: color === 'transparent' ? 'white' : color }}
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
  const [blockType, setBlockTypeState] = useState<BlockType>('paragraph');
  const [selectionFormats, setSelectionFormats] = useState<Set<string>>(new Set());
  const [alignment, setAlignment] = useState<string>('left');
  const [showColor, setShowColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [currentTextColor, setCurrentTextColor] = useState<string>(TEXT_COLORS[0]);
  const [currentHighlight, setCurrentHighlight] = useState<string>('transparent');

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();

      const formats = new Set<string>();
      if (selection.hasFormat('bold')) formats.add('bold');
      if (selection.hasFormat('italic')) formats.add('italic');
      if (selection.hasFormat('underline')) formats.add('underline');
      if (selection.hasFormat('code')) formats.add('code');
      setSelectionFormats(formats);

      if ($isHeadingNode(element)) {
        setBlockTypeState(element.getTag() as BlockType);
      } else if ($isListNode(element)) {
        setBlockTypeState('paragraph');
      } else {
        const type = element.getType();
        setBlockTypeState(type === 'paragraph' ? 'paragraph' : 'paragraph');
      }

      // Check format type for alignment - only ElementNode has getFormatType
      if ($isElementNode(element)) {
        const formatType = element.getFormatType();
        setAlignment(formatType || 'left');
      } else {
        setAlignment('left');
      }
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
        COMMAND_PRIORITY_LOW,
      ),
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
    [editor],
  );

  const handleBlockChange = (next: BlockType) => {
    setBlockTypeState(next);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (next === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(next));
        }
      }
    });
  };

  const toggleLink = useCallback(() => {
    const url = window.prompt('Enter URL');
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
          active={selectionFormats.has('bold')}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        >
          <Bold size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={selectionFormats.has('italic')}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        >
          <Italic size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={selectionFormats.has('underline')}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        >
          <Underline size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={selectionFormats.has('code')}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        >
          <Code size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={toggleLink}>
          <Link size={16} strokeWidth={2.5} />
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group lockin-note-toolbar-menu">
        <ToolbarButton
          label="Text color"
          onClick={() => setShowColor((v) => !v)}
          swatchColor={currentTextColor}
        >
          <Palette size={16} strokeWidth={2.5} />
        </ToolbarButton>
        {showColor ? (
          <SwatchMenu
            label="Text color"
            swatches={TEXT_COLORS}
            onSelect={(color) => {
              applyStyle({ color });
              setCurrentTextColor(color);
              setShowColor(false);
            }}
          />
        ) : null}
        <ToolbarButton
          label="Highlight"
          onClick={() => setShowHighlight((v) => !v)}
          swatchColor={currentHighlight}
        >
          <Highlighter size={16} strokeWidth={2.5} />
        </ToolbarButton>
        {showHighlight ? (
          <SwatchMenu
            label="Highlight"
            swatches={HIGHLIGHT_COLORS}
            onSelect={(color) => {
              if (color === 'transparent') {
                applyStyle({ 'background-color': 'transparent' });
              } else {
                applyStyle({ 'background-color': color });
              }
              setCurrentHighlight(color);
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
          <List size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        >
          <ListOrdered size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          onClick={() => {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createCodeNode());
              }
            });
          }}
        >
          <Braces size={16} strokeWidth={2.5} />
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton
          label="Align left"
          active={alignment === 'left' || alignment === 'start'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
        >
          <AlignLeft size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={alignment === 'center'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
        >
          <AlignCenter size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={alignment === 'right' || alignment === 'end'}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
        >
          <AlignRight size={16} strokeWidth={2.5} />
        </ToolbarButton>
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton label="Attach file" onClick={onOpenFilePicker} disabled={disableAttachment}>
          <Paperclip size={16} strokeWidth={2.5} />
        </ToolbarButton>
        {isUploading ? <span className="lockin-inline-spinner" aria-label="Uploading" /> : null}
      </div>

      <div className="lockin-note-toolbar-divider" />

      <div className="lockin-note-toolbar-group">
        <ToolbarButton label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
          <Undo2 size={16} strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
          <Redo2 size={16} strokeWidth={2.5} />
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
    return {
      label: error || 'Error saving - retry soon',
      tone: 'error' as const,
      spinner: false,
    };
  }
  if (status === 'error') {
    return {
      label: 'Error saving - retry soon',
      tone: 'error' as const,
      spinner: false,
    };
  }
  if (status === 'saving') {
    return { label: 'Saving...', tone: 'muted' as const, spinner: true };
  }
  if (isAssetUploading) {
    return {
      label: 'Uploading attachment...',
      tone: 'muted' as const,
      spinner: true,
    };
  }
  if (status === 'saved') {
    return {
      label: `Saved ${relativeLabel(updatedAt)}`,
      tone: 'success' as const,
      spinner: false,
    };
  }
  if (status === 'editing') {
    return { label: 'Editing...', tone: 'muted' as const, spinner: false };
  }
  return { label: 'Idle', tone: 'muted' as const, spinner: false };
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

  // Use note.id for existing notes, or a stable "new" key for drafts
  // This forces LexicalComposer to remount when switching notes
  const composerKey = note?.id ?? 'new-note';

  const initialEditorState = useMemo(() => {
    if (!note?.content) return null;
    if (note.content.version === 'lexical_v1' && note.content.editorState) {
      const state = note.content.editorState as any;
      if (typeof state === 'string') return state;
      try {
        return JSON.stringify(state);
      } catch {
        return null;
      }
    }
    return null;
  }, [note?.id, note?.content?.editorState]);

  const initialConfig: InitialConfigType = useMemo(
    () => ({
      namespace: 'LockInNoteEditor',
      theme,
      editorState: initialEditorState as any,
      editable: true,
      onError(error: Error) {
        console.error('Lexical editor error', error);
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
    [initialEditorState],
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
        <input
          className="lockin-note-title-input"
          value={title}
          placeholder="Note title..."
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <div className={`lockin-note-status is-${statusMeta.tone}`}>
          {statusMeta.spinner ? (
            <span className="lockin-inline-spinner" aria-hidden="true" />
          ) : null}
          <span>{statusMeta.label}</span>
        </div>
      </div>

      <LexicalComposer key={composerKey} initialConfig={initialConfig}>
        <NoteToolbar
          onOpenFilePicker={onUploadFile ? handleUploadClick : undefined}
          disableAttachment={!note?.id || !onUploadFile}
          isUploading={isAssetUploading}
        />

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
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>

        <HistoryPlugin />
        <ListPlugin />
        <ReactLinkPlugin />
        <AutoFocusPlugin />
        <NoteContentLoader note={note} onHydrationChange={setIsHydrating} />
        <NoteChangePlugin onChange={onContentChange} isHydrating={isHydrating} />
        <ShortcutsPlugin onSaveNow={onSaveNow} />
        <CaretScrollPlugin />
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
        style={{ display: 'none' }}
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
            fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
}

export const NoteEditor = NoteEditorShell;
