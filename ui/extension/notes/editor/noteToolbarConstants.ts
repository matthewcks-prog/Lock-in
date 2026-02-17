export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3';

export const BLOCK_OPTIONS: Array<{ value: BlockType; label: string }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
];

export const TEXT_COLORS = [
  '#111827',
  '#334155',
  '#2563eb',
  '#7c3aed',
  '#dc2626',
  '#059669',
  '#f59e0b',
];
export const HIGHLIGHT_COLORS = [
  '#fef3c7',
  '#e0f2fe',
  '#f3e8ff',
  '#dcfce7',
  '#fee2e2',
  'transparent',
];
