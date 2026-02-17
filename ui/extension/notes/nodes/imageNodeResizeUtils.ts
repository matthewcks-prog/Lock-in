import type { LexicalEditor } from 'lexical';

export const DEFAULT_WIDTH = 320;
export const MIN_WIDTH = 80;
export const MAX_WIDTH = 960;
const EDITOR_HORIZONTAL_PADDING_PX = 48;

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  maxWidth: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateAspectRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) {
    return 1;
  }
  const ratio = width / height;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 1;
  }
  return ratio;
}

export function hasPersistedDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): boolean {
  return width !== null && width !== undefined && height !== null && height !== undefined;
}

export function buildInitialDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): ImageDimensions {
  const initialWidth = width ?? DEFAULT_WIDTH;
  const initialHeight = height ?? DEFAULT_WIDTH;
  return {
    width: initialWidth,
    height: initialHeight,
    aspectRatio: calculateAspectRatio(initialWidth, initialHeight),
    maxWidth: MAX_WIDTH,
  };
}

export function getMaxWidth(editor: LexicalEditor): number {
  const root = editor.getRootElement();
  const scrollContainer = root?.closest('.lockin-note-editor-scroll') as HTMLElement | null;
  const container = scrollContainer ?? root?.parentElement;
  const measured = container?.getBoundingClientRect().width ?? 0;
  if (measured <= 0) {
    return MAX_WIDTH;
  }
  return clamp(measured - EDITOR_HORIZONTAL_PADDING_PX, MIN_WIDTH, MAX_WIDTH);
}

function getDiagonalDelta(
  handle: Extract<ResizeHandle, 'nw' | 'ne' | 'sw' | 'se'>,
  deltaX: number,
  deltaY: number,
  aspectRatio: number,
): number {
  const horizontal = handle === 'nw' || handle === 'sw' ? -deltaX : deltaX;
  const vertical = handle === 'nw' || handle === 'ne' ? -deltaY : deltaY;
  return Math.max(horizontal, vertical * aspectRatio);
}

export function getWidthDelta(
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  aspectRatio: number,
): number {
  if (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se') {
    return getDiagonalDelta(handle, deltaX, deltaY, aspectRatio);
  }
  if (handle === 'e') {
    return deltaX;
  }
  if (handle === 'w') {
    return -deltaX;
  }
  if (handle === 's') {
    return deltaY * aspectRatio;
  }
  return -deltaY * aspectRatio;
}
