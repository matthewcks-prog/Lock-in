import type {
  InlineContent,
  LinkNode,
  TextAlignment,
  TextFormatting,
  TextRun,
  TextStyles,
} from '../types';
import type { JsPDFInstance } from './pdfTypes';
import { PDF_CONFIG } from './pdfConfig';

export type RGB = [number, number, number];

export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: RGB;
  backgroundColor?: RGB;
}

export interface WrappedLine {
  spans: TextSpan[];
  width: number;
}

export interface RenderLinesOptions {
  fontSize: number;
  startX: number;
  maxWidth: number;
  alignment?: TextAlignment;
}

export interface RenderInlineOptions {
  startX: number;
  y: number;
  lineHeight: number;
}

interface RenderSpanOptions {
  x: number;
  y: number;
  lineHeight: number;
}

const POINT_TO_MM = 0.352778;
const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;
const HEX_SHORT_LENGTH = 3;
const HEX_RED_SHIFT = 16;
const HEX_GREEN_SHIFT = 8;
const RGB_MAX = 255;
const RGB_MID = 128;
const RGB_ORANGE_GREEN = 165;
const RGB_PINK_GREEN = 192;
const RGB_PINK_BLUE = 203;
const RGB_LINK_BLUE = 238;
const LINK_COLOR: RGB = [0, 0, RGB_LINK_BLUE];
const HIGHLIGHT_OFFSET_RATIO = 0.7;
export const DECORATION_OFFSET_RATIO = 0.3;
const DECORATION_LINE_WIDTH = 0.2;
const UNDERLINE_OFFSET_MM = 0.5;
const DEFAULT_FONT = 'helvetica';
const CODE_FONT = 'courier';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const setTextColor = (doc: JsPDFInstance, color: RGB): void => {
  doc.setTextColor(color[0], color[1], color[2]);
};

const setFillColor = (doc: JsPDFInstance, color: RGB): void => {
  doc.setFillColor(color[0], color[1], color[2]);
};

const setDrawColor = (doc: JsPDFInstance, color: RGB): void => {
  doc.setDrawColor(color[0], color[1], color[2]);
};

export const resetTextStyle = (doc: JsPDFInstance): void => {
  doc.setFont(DEFAULT_FONT, 'normal');
  setTextColor(doc, PDF_CONFIG.textColor);
};

export const getTextHeight = (fontSize: number): number =>
  fontSize * PDF_CONFIG.lineHeight * POINT_TO_MM;

export const wrapText = (doc: JsPDFInstance, text: string, maxWidth: number): string[] =>
  doc.splitTextToSize(text, maxWidth);

export const ensurePageSpace = (doc: JsPDFInstance, currentY: number, height: number): number => {
  if (currentY + height > PDF_CONFIG.pageHeight - PDF_CONFIG.marginBottom) {
    doc.addPage();
    return PDF_CONFIG.marginTop;
  }
  return currentY;
};

const parseColor = (cssColor: string): RGB | null => {
  const trimmed = cssColor.trim().toLowerCase();

  const hexMatch = trimmed.match(/^#([a-f0-9]{3,6})$/i);
  if (hexMatch !== null) {
    const hexCandidate = hexMatch[1];
    if (hexCandidate === undefined) {
      return null;
    }
    let hex = hexCandidate;
    if (hex.length === HEX_SHORT_LENGTH) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const num = parseInt(hex, HEX_RADIX);
    return [(num >> HEX_RED_SHIFT) & RGB_MAX, (num >> HEX_GREEN_SHIFT) & RGB_MAX, num & RGB_MAX];
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch !== null) {
    const [_, r, g, b] = rgbMatch;
    if (r === undefined || g === undefined || b === undefined) return null;
    return [parseInt(r, DECIMAL_RADIX), parseInt(g, DECIMAL_RADIX), parseInt(b, DECIMAL_RADIX)];
  }

  const namedColors: Record<string, RGB> = {
    black: [0, 0, 0],
    white: [RGB_MAX, RGB_MAX, RGB_MAX],
    red: [RGB_MAX, 0, 0],
    green: [0, RGB_MID, 0],
    blue: [0, 0, RGB_MAX],
    yellow: [RGB_MAX, RGB_MAX, 0],
    orange: [RGB_MAX, RGB_ORANGE_GREEN, 0],
    purple: [RGB_MID, 0, RGB_MID],
    pink: [RGB_MAX, RGB_PINK_GREEN, RGB_PINK_BLUE],
    gray: [RGB_MID, RGB_MID, RGB_MID],
    grey: [RGB_MID, RGB_MID, RGB_MID],
  };
  return namedColors[trimmed] ?? null;
};

const resolveColor = (value: string | undefined): RGB | undefined => {
  if (!isNonEmptyString(value)) return undefined;
  const parsed = parseColor(value);
  return parsed ?? undefined;
};

const applyFormatting = (span: TextSpan, format: TextFormatting): void => {
  if (format.bold === true) span.bold = true;
  if (format.italic === true) span.italic = true;
  if (format.underline === true) span.underline = true;
  if (format.strikethrough === true) span.strikethrough = true;
  if (format.code === true) span.code = true;
};

const applyStyles = (span: TextSpan, styles?: TextStyles): void => {
  if (styles === undefined) return;

  const color = resolveColor(styles.color);
  if (color !== undefined) span.color = color;

  const backgroundColor = resolveColor(styles.backgroundColor);
  if (backgroundColor !== undefined) span.backgroundColor = backgroundColor;
};

const createTextSpan = (run: TextRun): TextSpan => {
  const span: TextSpan = { text: run.text };
  applyFormatting(span, run.format);
  applyStyles(span, run.styles);
  return span;
};

const createLinkSpan = (run: TextRun): TextSpan => {
  const span: TextSpan = { text: run.text, underline: true, color: LINK_COLOR };
  applyFormatting(span, run.format);
  return span;
};

const createLinkSpans = (link: LinkNode): TextSpan[] => link.children.map(createLinkSpan);

export const inlineContentToSpans = (content: InlineContent[]): TextSpan[] => {
  const spans: TextSpan[] = [];
  for (const item of content) {
    if (item.type === 'text') {
      spans.push(createTextSpan(item));
      continue;
    }
    spans.push(...createLinkSpans(item));
  }
  return spans;
};

const getFontStyle = (span: TextSpan): string => {
  if (span.bold === true && span.italic === true) return 'bolditalic';
  if (span.bold === true) return 'bold';
  if (span.italic === true) return 'italic';
  return 'normal';
};

const getFontFamily = (span: TextSpan): string => (span.code === true ? CODE_FONT : DEFAULT_FONT);

export const buildWrappedLines = (
  doc: JsPDFInstance,
  spans: TextSpan[],
  maxWidth: number,
): WrappedLine[] => {
  const lines: WrappedLine[] = [];
  let current: TextSpan[] = [];
  let width = 0;

  const pushLine = (): void => {
    if (current.length > 0) {
      lines.push({ spans: current, width });
      current = [];
      width = 0;
    }
  };

  for (const span of spans) {
    for (const [index, part] of span.text.split('\n').entries()) {
      if (index > 0) pushLine();
      if (part.length === 0) continue;

      doc.setFont(getFontFamily(span), getFontStyle(span));
      for (const word of part.split(/(\s+)/)) {
        const wordWidth = doc.getTextWidth(word);
        if (width + wordWidth > maxWidth && current.length > 0) pushLine();
        const trimmedWord = word.trim();
        if (trimmedWord.length > 0 || current.length > 0) {
          current.push({ ...span, text: word });
          width += wordWidth;
        }
      }
    }
  }
  pushLine();
  return lines;
};

const getAlignedX = (
  textWidth: number,
  alignment: TextAlignment | undefined,
  baseX: number,
  maxWidth: number,
): number => {
  if (alignment === 'center') return baseX + (maxWidth - textWidth) / 2;
  if (alignment === 'right') return baseX + maxWidth - textWidth;
  return baseX;
};

const renderSpan = (doc: JsPDFInstance, span: TextSpan, options: RenderSpanOptions): number => {
  const { x, y, lineHeight } = options;
  doc.setFont(getFontFamily(span), getFontStyle(span));
  const textWidth = doc.getTextWidth(span.text);

  if (span.backgroundColor !== undefined) {
    setFillColor(doc, span.backgroundColor);
    doc.rect(x, y - lineHeight * HIGHLIGHT_OFFSET_RATIO, textWidth, lineHeight, 'F');
  }

  const textColor = span.color ?? PDF_CONFIG.textColor;
  setTextColor(doc, textColor);
  doc.text(span.text, x, y);

  if (span.underline === true) {
    setDrawColor(doc, textColor);
    doc.setLineWidth(DECORATION_LINE_WIDTH);
    doc.line(x, y + UNDERLINE_OFFSET_MM, x + textWidth, y + UNDERLINE_OFFSET_MM);
  }
  if (span.strikethrough === true) {
    setDrawColor(doc, textColor);
    doc.setLineWidth(DECORATION_LINE_WIDTH);
    doc.line(
      x,
      y - lineHeight * DECORATION_OFFSET_RATIO,
      x + textWidth,
      y - lineHeight * DECORATION_OFFSET_RATIO,
    );
  }

  return textWidth;
};

export const renderInlineSpans = (
  doc: JsPDFInstance,
  spans: TextSpan[],
  options: RenderInlineOptions,
): number => {
  let x = options.startX;
  for (const span of spans) {
    x += renderSpan(doc, span, { x, y: options.y, lineHeight: options.lineHeight });
  }
  resetTextStyle(doc);
  return x;
};

export const renderLines = (
  doc: JsPDFInstance,
  lines: WrappedLine[],
  startY: number,
  options: RenderLinesOptions,
): number => {
  const lineHeight = getTextHeight(options.fontSize);
  doc.setFontSize(options.fontSize);

  let y = startY;
  for (const line of lines) {
    y = ensurePageSpace(doc, y, lineHeight);
    let x = getAlignedX(line.width, options.alignment, options.startX, options.maxWidth);
    for (const span of line.spans) {
      x += renderSpan(doc, span, { x, y, lineHeight });
    }
    y += lineHeight;
  }

  resetTextStyle(doc);
  return y;
};
