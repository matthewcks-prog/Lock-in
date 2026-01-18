import { useEffect } from 'react';
import { $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import type { Note } from '@core/domain/Note';

/**
 * NoteContentLoader handles:
 * 1. Initial hydration signaling (for asset cleanup timing)
 * 2. Legacy HTML migration for old notes that don't have lexical state
 *
 * Since LexicalComposer uses a `key` based on note.id, it remounts when
 * switching notes. The initialConfig.editorState handles loading the
 * Lexical state. This plugin only needs to handle the legacy HTML case.
 */
export function NoteContentLoader({
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
