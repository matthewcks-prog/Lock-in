import {
  parseNote,
  type Note,
  type NoteContent,
  type NoteContentVersion,
  type NoteType,
} from '../../domain/Note';

type NotePayload = {
  title?: string;
  content?: string;
  content_text?: string | null;
  content_json?: unknown;
  editor_version?: string;
  clientNoteId?: string;
  sourceSelection?: string | null;
  source_selection?: string | null;
  sourceUrl?: string | null;
  source_url?: string | null;
  courseCode?: string | null;
  course_code?: string | null;
  noteType?: string | null;
  note_type?: string | null;
  tags?: string[];
};

type NoteRecord = Record<string, unknown>;

const NOTE_TYPES: NoteType[] = [
  'manual',
  'definition',
  'formula',
  'concept',
  'general',
  'ai-generated',
  'transcript',
  'quiz',
  'key_takeaways',
];

const DEFAULT_CONTENT: NoteContent = {
  version: 'lexical_v1',
  editorState: null,
  legacyHtml: null,
  plainText: '',
};

const isRecord = (value: unknown): value is NoteRecord =>
  typeof value === 'object' && value !== null;

const safeParseJson = (value: unknown): unknown | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const stripHtml = (html: string): string => {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body?.textContent ?? '';
    } catch {
      // fall through to regex fallback
    }
  }
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const createPlainTextEditorState = (text: string): Record<string, unknown> => {
  const hasText = text.length > 0;
  const paragraph = {
    children: hasText
      ? [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text,
            type: 'text',
            version: 1,
          },
        ]
      : [],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  };

  return {
    root: {
      children: [paragraph],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
};

const legacyHtmlToNoteContent = (html: string): NoteContent => {
  const plainText = stripHtml(html);
  return {
    version: 'lexical_v1',
    editorState: createPlainTextEditorState(plainText),
    legacyHtml: html,
    plainText,
  };
};

const extractPlainTextFromEditorState = (editorState: unknown): string => {
  try {
    const parsed = typeof editorState === 'string' ? safeParseJson(editorState) : editorState;
    if (!isRecord(parsed)) return '';

    const collectText = (node: unknown): string => {
      if (!isRecord(node)) return '';
      const textValue = node['text'];
      if (typeof textValue === 'string') return textValue;
      const children = node['children'];
      if (Array.isArray(children)) {
        return children
          .map(collectText)
          .filter((segment) => segment.length > 0)
          .join(' ');
      }
      return '';
    };

    const root = parsed['root'];
    if (!isRecord(root)) return '';
    const children = root['children'];
    const segments = Array.isArray(children)
      ? children.map(collectText).filter((segment) => segment.length > 0)
      : [];
    return segments.join(' ').trim();
  } catch {
    return '';
  }
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const readNonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const firstNonEmptyString = (values: Array<unknown>): string | undefined => {
  for (const value of values) {
    const candidate = readNonEmptyString(value);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
};

const firstStringOrNull = (values: Array<unknown>): string | null =>
  firstNonEmptyString(values) ?? null;

const normalizeContent = (raw: NoteRecord | null | undefined): NoteContent => {
  const record = raw ?? {};
  const editorVersion = readString(record['editor_version']) ?? readString(record['editorVersion']);
  const normalizedVersion: NoteContentVersion =
    editorVersion === 'legacy_html' || editorVersion === 'lexical_v1'
      ? editorVersion
      : 'lexical_v1';
  const contentJson = safeParseJson(record['content_json'] ?? record['contentJson']);
  const legacyContent = readNonEmptyString(record['content']);
  const contentText =
    readNonEmptyString(record['content_text']) ?? readNonEmptyString(record['plain_text']);

  if (contentJson !== null) {
    return {
      version: normalizedVersion,
      editorState: contentJson,
      legacyHtml: legacyContent ?? null,
      plainText: contentText ?? stripHtml(legacyContent ?? ''),
    };
  }

  if (legacyContent !== undefined) {
    return legacyHtmlToNoteContent(legacyContent);
  }

  return { ...DEFAULT_CONTENT };
};

const resolvePlainText = (content: NoteContent): string => {
  const plainText = content.plainText;
  if (typeof plainText === 'string' && plainText.length > 0) return plainText;
  return extractPlainTextFromEditorState(content.editorState);
};

const toDomainNote = (raw: NoteRecord | null | undefined): Note => {
  const record = raw ?? {};
  const content = normalizeContent(raw);
  const previewCandidate = firstNonEmptyString([
    record['preview'],
    record['content_text'],
    content.plainText,
  ]);
  const preview = previewCandidate ?? extractPlainTextFromEditorState(content.editorState);
  const linkedLabel = firstNonEmptyString([
    record['linked_label'],
    record['course_code'],
    record['courseCode'],
  ]);
  const rawNoteType = firstNonEmptyString([record['note_type'], record['noteType']]);

  const tags = Array.isArray(record['tags'])
    ? record['tags'].filter((tag): tag is string => typeof tag === 'string')
    : [];

  const normalizedNoteType: NoteType =
    rawNoteType !== undefined && NOTE_TYPES.includes(rawNoteType as NoteType)
      ? (rawNoteType as NoteType)
      : 'manual';

  const note: Note = {
    id: readString(record['id']) ?? null,
    title: readNonEmptyString(record['title']) ?? 'Untitled note',
    content,
    sourceUrl: firstStringOrNull([record['source_url'], record['sourceUrl']]),
    sourceSelection: firstStringOrNull([record['source_selection'], record['sourceSelection']]),
    courseCode: firstStringOrNull([record['course_code'], record['courseCode']]),
    noteType: normalizedNoteType,
    tags,
    createdAt: firstStringOrNull([record['created_at'], record['createdAt']]),
    updatedAt: firstStringOrNull([record['updated_at'], record['updatedAt']]),
    isStarred: Boolean(record['is_starred'] ?? record['isStarred']),
    previewText: preview,
  };
  if (linkedLabel !== undefined) {
    note.linkedLabel = linkedLabel;
  }
  return parseNote(note);
};

const toBackendPayload = (content: NoteContent | undefined): NotePayload => {
  if (content === undefined) return {};
  const resolvedPlainText = resolvePlainText(content);
  const editorState =
    content.editorState ??
    createPlainTextEditorState(resolvedPlainText.length > 0 ? resolvedPlainText : '');
  const plainText = resolvedPlainText.length > 0 ? resolvedPlainText : null;

  if (content.version === 'lexical_v1') {
    return {
      content_json: editorState,
      editor_version: 'lexical_v1',
      // Keep legacy compatibility: send HTML/plain as a fallback field
      content: content.legacyHtml ?? plainText ?? '',
      content_text: plainText ?? '',
    };
  }

  return {
    content_json: editorState,
    editor_version: content.version,
    content: content.legacyHtml ?? plainText ?? '',
    content_text: plainText ?? '',
  };
};

export {
  extractPlainTextFromEditorState,
  legacyHtmlToNoteContent,
  normalizeContent,
  toBackendPayload,
  toDomainNote,
};
export type { NotePayload, NoteRecord };
