import type { Note, NoteContent } from '@core/domain/Note';

const UUID_BYTE_LENGTH = 16;
const RANDOM_BYTE_RANGE = 256;
const UUID_VERSION_BYTE_INDEX = 6;
const UUID_VARIANT_BYTE_INDEX = 8;
const UUID_VERSION_MASK = 0x0f;
const UUID_VERSION_4_FLAG = 0x40;
const UUID_VARIANT_MASK = 0x3f;
const UUID_VARIANT_RFC4122_FLAG = 0x80;
const HEX_RADIX = 16;
const HEX_PAD_LENGTH = 2;
const UUID_SEGMENT_1_END = 4;
const UUID_SEGMENT_2_END = 6;
const UUID_SEGMENT_3_END = 8;
const UUID_SEGMENT_4_END = 10;

export function createClientNoteId(): string {
  const globalCrypto =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (globalCrypto !== undefined && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }

  const bytes = new Uint8Array(UUID_BYTE_LENGTH);
  if (globalCrypto !== undefined && typeof globalCrypto.getRandomValues === 'function') {
    globalCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * RANDOM_BYTE_RANGE);
    }
  }

  bytes[UUID_VERSION_BYTE_INDEX] =
    ((bytes[UUID_VERSION_BYTE_INDEX] ?? 0) & UUID_VERSION_MASK) | UUID_VERSION_4_FLAG;
  bytes[UUID_VARIANT_BYTE_INDEX] =
    ((bytes[UUID_VARIANT_BYTE_INDEX] ?? 0) & UUID_VARIANT_MASK) | UUID_VARIANT_RFC4122_FLAG;
  const hex = Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD_LENGTH, '0'));
  return `${hex.slice(0, UUID_SEGMENT_1_END).join('')}-${hex
    .slice(UUID_SEGMENT_1_END, UUID_SEGMENT_2_END)
    .join('')}-${hex.slice(UUID_SEGMENT_2_END, UUID_SEGMENT_3_END).join('')}-${hex
    .slice(UUID_SEGMENT_3_END, UUID_SEGMENT_4_END)
    .join('')}-${hex.slice(UUID_SEGMENT_4_END, UUID_BYTE_LENGTH).join('')}`;
}

export function createDraftNote(opts: {
  courseCode?: string | null;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
}): Note {
  const note: Note = {
    id: null,
    title: '',
    content: {
      version: 'lexical_v1',
      editorState: null,
      legacyHtml: null,
      plainText: '',
    },
    sourceUrl: opts.sourceUrl ?? null,
    sourceSelection: opts.sourceSelection ?? null,
    courseCode: opts.courseCode ?? null,
    noteType: 'manual',
    tags: [],
    createdAt: null,
    updatedAt: null,
    isStarred: false,
    previewText: '',
  };
  if (opts.courseCode !== null && opts.courseCode !== undefined && opts.courseCode.length > 0) {
    note.linkedLabel = opts.courseCode;
  }
  return note;
}

export function createContentFingerprint(title: string, content: NoteContent): string {
  return JSON.stringify({
    title: title.trim(),
    content: content.editorState,
    version: content.version,
    legacy: content.legacyHtml,
    plainText: content.plainText,
  });
}
