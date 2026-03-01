import type { NoteContent } from '@core/domain/Note';

export function createNoteContentFromPlainText(text: string): NoteContent {
  const normalized = text.length > 0 ? text : '';
  const textNode =
    normalized.length > 0
      ? [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: normalized,
            type: 'text',
            version: 1,
          },
        ]
      : [];

  return {
    version: 'lexical_v1',
    editorState: {
      root: {
        children: [
          {
            children: textNode,
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    },
    legacyHtml: null,
    plainText: normalized,
  };
}
