/**
 * PDF Builder
 *
 * Wraps jsPDF with layout logic for document generation.
 * Handles pagination, text wrapping, and consistent styling.
 * Supports rich text formatting including colors and highlighting.
 */

import type { InlineContent, TextAlignment } from '../types';
import { PDF_CONFIG } from './pdfConfig';

// ============================================================================
// jsPDF Type Declarations
// ============================================================================

export interface JsPDFInstance {
  setFont(fontName: string, fontStyle: string): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setFillColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(width: number): void;
  text(text: string, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  addPage(): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  getTextWidth(text: string): number;
  output(type: 'blob'): Blob;
}

export interface JsPDFConstructor {
  new (options: { orientation: string; unit: string; format: string }): JsPDFInstance;
}

// ============================================================================
// Types
// ============================================================================

type RGB = [number, number, number];

interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: RGB;
  backgroundColor?: RGB;
}

interface WrappedLine {
  spans: TextSpan[];
  width: number;
}

// ============================================================================
// Color Utilities
// ============================================================================

function parseColor(cssColor: string): RGB | null {
  const trimmed = cssColor.trim().toLowerCase();

  const hexMatch = trimmed.match(/^#([a-f0-9]{3,6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }

  const namedColors: Record<string, RGB> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    orange: [255, 165, 0],
    purple: [128, 0, 128],
    pink: [255, 192, 203],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
  };
  return namedColors[trimmed] || null;
}

function getFontStyle(span: TextSpan): string {
  if (span.bold && span.italic) return 'bolditalic';
  if (span.bold) return 'bold';
  if (span.italic) return 'italic';
  return 'normal';
}

function getFontFamily(span: TextSpan): string {
  return span.code ? 'courier' : 'helvetica';
}

// ============================================================================
// PDF Builder Class
// ============================================================================

export class PdfBuilder {
  private doc: JsPDFInstance;
  private y: number;
  private contentWidth: number;

  constructor(JsPDFCtor: JsPDFConstructor) {
    this.doc = new JsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.y = PDF_CONFIG.marginTop;
    this.contentWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.marginLeft - PDF_CONFIG.marginRight;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.setColor(PDF_CONFIG.textColor);
  }

  // ---------------------------------------------------------------------------
  // Basic Helpers
  // ---------------------------------------------------------------------------

  private setColor(color: RGB): void {
    this.doc.setTextColor(color[0], color[1], color[2]);
  }
  private setFillColor(color: RGB): void {
    this.doc.setFillColor(color[0], color[1], color[2]);
  }
  private setDrawColor(color: RGB): void {
    this.doc.setDrawColor(color[0], color[1], color[2]);
  }
  private getTextHeight(fontSize: number): number {
    return fontSize * PDF_CONFIG.lineHeight * 0.352778;
  }
  private wrapText(text: string, maxWidth: number): string[] {
    return this.doc.splitTextToSize(text, maxWidth);
  }

  private checkPageBreak(height: number): void {
    if (this.y + height > PDF_CONFIG.pageHeight - PDF_CONFIG.marginBottom) {
      this.doc.addPage();
      this.y = PDF_CONFIG.marginTop;
    }
  }

  private getAlignedX(
    textWidth: number,
    alignment: TextAlignment | undefined,
    baseX: number,
    maxWidth: number,
  ): number {
    if (alignment === 'center') return baseX + (maxWidth - textWidth) / 2;
    if (alignment === 'right') return baseX + maxWidth - textWidth;
    return baseX;
  }

  // ---------------------------------------------------------------------------
  // Span Conversion
  // ---------------------------------------------------------------------------

  private inlineToSpans(content: InlineContent[]): TextSpan[] {
    const spans: TextSpan[] = [];
    for (const item of content) {
      if (item.type === 'text') {
        spans.push({
          text: item.text,
          bold: item.format.bold,
          italic: item.format.italic,
          underline: item.format.underline,
          strikethrough: item.format.strikethrough,
          code: item.format.code,
          color: item.styles?.color ? (parseColor(item.styles.color) ?? undefined) : undefined,
          backgroundColor: item.styles?.backgroundColor
            ? (parseColor(item.styles.backgroundColor) ?? undefined)
            : undefined,
        });
      } else if (item.type === 'link') {
        for (const child of item.children) {
          spans.push({
            text: child.text,
            bold: child.format.bold,
            italic: child.format.italic,
            underline: true,
            strikethrough: child.format.strikethrough,
            code: child.format.code,
            color: [0, 0, 238],
          });
        }
      }
    }
    return spans;
  }

  // ---------------------------------------------------------------------------
  // Line Building
  // ---------------------------------------------------------------------------

  private buildLines(spans: TextSpan[], maxWidth: number): WrappedLine[] {
    const lines: WrappedLine[] = [];
    let current: TextSpan[] = [];
    let width = 0;

    const pushLine = () => {
      if (current.length) {
        lines.push({ spans: current, width });
        current = [];
        width = 0;
      }
    };

    for (const span of spans) {
      for (const [i, part] of span.text.split('\n').entries()) {
        if (i > 0) pushLine();
        if (!part) continue;

        this.doc.setFont(getFontFamily(span), getFontStyle(span));
        for (const word of part.split(/(\s+)/)) {
          const wordWidth = this.doc.getTextWidth(word);
          if (width + wordWidth > maxWidth && current.length) pushLine();
          if (word.trim() || current.length) {
            current.push({ ...span, text: word });
            width += wordWidth;
          }
        }
      }
    }
    pushLine();
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Span Rendering
  // ---------------------------------------------------------------------------

  private renderSpan(span: TextSpan, x: number, lineHeight: number): number {
    this.doc.setFont(getFontFamily(span), getFontStyle(span));
    const textWidth = this.doc.getTextWidth(span.text);

    if (span.backgroundColor) {
      this.setFillColor(span.backgroundColor);
      this.doc.rect(x, this.y - lineHeight * 0.7, textWidth, lineHeight, 'F');
    }

    this.setColor(span.color || PDF_CONFIG.textColor);
    this.doc.text(span.text, x, this.y);

    if (span.underline) {
      this.setDrawColor(span.color || PDF_CONFIG.textColor);
      this.doc.setLineWidth(0.2);
      this.doc.line(x, this.y + 0.5, x + textWidth, this.y + 0.5);
    }
    if (span.strikethrough) {
      this.setDrawColor(span.color || PDF_CONFIG.textColor);
      this.doc.setLineWidth(0.2);
      this.doc.line(x, this.y - lineHeight * 0.3, x + textWidth, this.y - lineHeight * 0.3);
    }

    return textWidth;
  }

  private renderLines(
    lines: WrappedLine[],
    fontSize: number,
    startX: number,
    maxWidth: number,
    alignment?: TextAlignment,
  ): void {
    const lineHeight = this.getTextHeight(fontSize);
    this.doc.setFontSize(fontSize);

    for (const line of lines) {
      this.checkPageBreak(lineHeight);
      let x = this.getAlignedX(line.width, alignment, startX, maxWidth);
      for (const span of line.spans) x += this.renderSpan(span, x, lineHeight);
      this.y += lineHeight;
    }

    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);
  }

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  addTitle(title: string): void {
    this.doc.setFontSize(PDF_CONFIG.titleSize);
    this.doc.setFont('helvetica', 'bold');
    this.setColor(PDF_CONFIG.textColor);

    const lineHeight = this.getTextHeight(PDF_CONFIG.titleSize);
    for (const line of this.wrapText(title, this.contentWidth)) {
      this.checkPageBreak(lineHeight);
      this.doc.text(line, PDF_CONFIG.marginLeft, this.y);
      this.y += lineHeight;
    }

    this.y += PDF_CONFIG.headingSpacing;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(PDF_CONFIG.bodySize);
  }

  addMetadata(parts: string[]): void {
    if (!parts.length) return;
    this.doc.setFontSize(PDF_CONFIG.metaSize);
    this.setColor(PDF_CONFIG.metaColor);

    const lineHeight = this.getTextHeight(PDF_CONFIG.metaSize);
    this.checkPageBreak(lineHeight);
    this.doc.text(parts.join(' | '), PDF_CONFIG.marginLeft, this.y);
    this.y += lineHeight + PDF_CONFIG.paragraphSpacing;

    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.setColor(PDF_CONFIG.textColor);
  }

  addHeading(content: InlineContent[], level: number, alignment?: TextAlignment): void {
    const fontSize =
      PDF_CONFIG.headingSizes[Math.min(level - 1, PDF_CONFIG.headingSizes.length - 1)];
    this.y += PDF_CONFIG.headingSpacing / 2;

    const spans = this.inlineToSpans(content).map((s) => ({ ...s, bold: true }));
    this.renderLines(
      this.buildLines(spans, this.contentWidth),
      fontSize,
      PDF_CONFIG.marginLeft,
      this.contentWidth,
      alignment,
    );
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addParagraph(content: InlineContent[], alignment?: TextAlignment): void {
    const spans = this.inlineToSpans(content);
    if (spans.every((s) => !s.text.trim())) return;

    this.renderLines(
      this.buildLines(spans, this.contentWidth),
      PDF_CONFIG.bodySize,
      PDF_CONFIG.marginLeft,
      this.contentWidth,
      alignment,
    );
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addListItem(content: InlineContent[], index: number, ordered: boolean): void {
    const prefix = ordered ? `${index + 1}. ` : '\u2022 ';
    const lineHeight = this.getTextHeight(PDF_CONFIG.bodySize);

    this.checkPageBreak(lineHeight);
    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);
    this.doc.text(prefix, PDF_CONFIG.marginLeft, this.y);

    const prefixWidth = this.doc.getTextWidth(prefix);
    const contentX = PDF_CONFIG.marginLeft + Math.max(prefixWidth, PDF_CONFIG.listIndent);
    const contentWidth = this.contentWidth - PDF_CONFIG.listIndent;

    const spans = this.inlineToSpans(content);
    const lines = this.buildLines(spans, contentWidth - prefixWidth);

    if (!lines.length) {
      this.y += lineHeight;
      return;
    }

    // First line rendered inline with prefix
    let x = contentX;
    for (const span of lines[0].spans) x += this.renderSpan(span, x, lineHeight);
    this.y += lineHeight;

    // Remaining lines at indent
    if (lines.length > 1) {
      this.renderLines(
        lines.slice(1),
        PDF_CONFIG.bodySize,
        PDF_CONFIG.marginLeft + PDF_CONFIG.listIndent,
        contentWidth,
      );
    }

    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);
  }

  endList(): void {
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addQuote(content: InlineContent[], alignment?: TextAlignment): void {
    const spans = this.inlineToSpans(content);
    if (spans.every((s) => !s.text.trim())) return;

    const quoteWidth = this.contentWidth - PDF_CONFIG.quoteIndent;
    const lineHeight = this.getTextHeight(PDF_CONFIG.bodySize);
    const estimatedHeight =
      this.wrapText(spans.map((s) => s.text).join(''), quoteWidth).length * lineHeight;

    this.checkPageBreak(estimatedHeight);

    // Left border
    this.setDrawColor(PDF_CONFIG.quoteBorder);
    this.doc.setLineWidth(0.5);
    this.doc.line(
      PDF_CONFIG.marginLeft,
      this.y - lineHeight * 0.3,
      PDF_CONFIG.marginLeft,
      this.y + estimatedHeight - lineHeight * 0.5,
    );

    const quotedSpans = spans.map((s) => ({
      ...s,
      italic: true,
      color: s.color || (PDF_CONFIG.metaColor as RGB),
    }));
    this.renderLines(
      this.buildLines(quotedSpans, quoteWidth),
      PDF_CONFIG.bodySize,
      PDF_CONFIG.marginLeft + PDF_CONFIG.quoteIndent,
      quoteWidth,
      alignment,
    );
    this.y += PDF_CONFIG.paragraphSpacing;

    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);
  }

  addCodeBlock(code: string): void {
    if (!code.trim()) return;

    this.doc.setFontSize(PDF_CONFIG.codeSize);
    this.doc.setFont('courier', 'normal');

    const codeWidth = this.contentWidth - PDF_CONFIG.codeIndent * 2;
    const codeLines = code.split('\n').flatMap((line) => this.wrapText(line || ' ', codeWidth));
    const lineHeight = this.getTextHeight(PDF_CONFIG.codeSize);
    const blockHeight = codeLines.length * lineHeight + PDF_CONFIG.codeIndent;

    this.checkPageBreak(blockHeight);

    this.setFillColor(PDF_CONFIG.codeBackground);
    this.doc.rect(
      PDF_CONFIG.marginLeft,
      this.y - lineHeight * 0.5,
      this.contentWidth,
      blockHeight,
      'F',
    );

    this.setColor(PDF_CONFIG.textColor);
    const x = PDF_CONFIG.marginLeft + PDF_CONFIG.codeIndent;
    this.y += PDF_CONFIG.codeIndent / 2;

    for (const line of codeLines) {
      this.doc.text(line, x, this.y);
      this.y += lineHeight;
    }

    this.y += PDF_CONFIG.paragraphSpacing + PDF_CONFIG.codeIndent / 2;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(PDF_CONFIG.bodySize);
  }

  addLineBreak(): void {
    this.y += PDF_CONFIG.paragraphSpacing;
  }
  toBlob(): Blob {
    return this.doc.output('blob');
  }
}
