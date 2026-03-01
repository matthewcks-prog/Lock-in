/**
 * PDF Builder
 *
 * Wraps jsPDF with layout logic for document generation.
 * Handles pagination, text wrapping, and consistent styling.
 * Supports rich text formatting including colors and highlighting.
 */

import type { InlineContent, TextAlignment } from '../types';
import { PDF_CONFIG } from './pdfConfig';
import type { JsPDFConstructor, JsPDFInstance } from './pdfTypes';
import {
  buildWrappedLines,
  DECORATION_OFFSET_RATIO,
  ensurePageSpace,
  getTextHeight,
  inlineContentToSpans,
  renderInlineSpans,
  renderLines,
  resetTextStyle,
  wrapText,
  type RenderLinesOptions,
  type RGB,
  type WrappedLine,
} from './pdfTextRenderer';

const HALF_LINE_HEIGHT_RATIO = 0.5;
const QUOTE_BORDER_LINE_WIDTH = 0.5;
const LIST_BULLET = '\u2022 ';

interface ListLayout {
  contentX: number;
  contentWidth: number;
  indentX: number;
  prefixWidth: number;
}

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

  private setColor(color: RGB): void {
    this.doc.setTextColor(color[0], color[1], color[2]);
  }
  private setFillColor(color: RGB): void {
    this.doc.setFillColor(color[0], color[1], color[2]);
  }
  private setDrawColor(color: RGB): void {
    this.doc.setDrawColor(color[0], color[1], color[2]);
  }
  private ensureSpace(height: number): void {
    this.y = ensurePageSpace(this.doc, this.y, height);
  }

  private buildRenderLinesOptions(
    fontSize: number,
    startX: number,
    maxWidth: number,
    alignment?: TextAlignment,
  ): RenderLinesOptions {
    const options: RenderLinesOptions = {
      fontSize,
      startX,
      maxWidth,
    };
    if (alignment !== undefined) {
      options.alignment = alignment;
    }
    return options;
  }

  private getListPrefix(index: number, ordered: boolean): string {
    return ordered ? `${index + 1}. ` : LIST_BULLET;
  }

  private getListLayout(prefixWidth: number): ListLayout {
    const contentX = PDF_CONFIG.marginLeft + Math.max(prefixWidth, PDF_CONFIG.listIndent);
    const contentWidth = this.contentWidth - PDF_CONFIG.listIndent;
    const indentX = PDF_CONFIG.marginLeft + PDF_CONFIG.listIndent;

    return {
      contentX,
      contentWidth,
      indentX,
      prefixWidth,
    };
  }

  private buildListLines(content: InlineContent[], maxWidth: number): WrappedLine[] {
    const spans = inlineContentToSpans(content);
    return buildWrappedLines(this.doc, spans, maxWidth);
  }

  private renderListLines(lines: WrappedLine[], layout: ListLayout, lineHeight: number): void {
    if (lines.length === 0) {
      this.y += lineHeight;
      return;
    }

    const firstLine = lines[0];
    if (firstLine === undefined) {
      this.y += lineHeight;
      return;
    }

    renderInlineSpans(this.doc, firstLine.spans, {
      startX: layout.contentX,
      y: this.y,
      lineHeight,
    });
    this.y += lineHeight;

    if (lines.length > 1) {
      this.y = renderLines(this.doc, lines.slice(1), this.y, {
        fontSize: PDF_CONFIG.bodySize,
        startX: layout.indentX,
        maxWidth: layout.contentWidth,
      });
    }
  }

  addTitle(title: string): void {
    this.doc.setFontSize(PDF_CONFIG.titleSize);
    this.doc.setFont('helvetica', 'bold');
    this.setColor(PDF_CONFIG.textColor);

    const lineHeight = getTextHeight(PDF_CONFIG.titleSize);
    for (const line of wrapText(this.doc, title, this.contentWidth)) {
      this.ensureSpace(lineHeight);
      this.doc.text(line, PDF_CONFIG.marginLeft, this.y);
      this.y += lineHeight;
    }

    this.y += PDF_CONFIG.headingSpacing;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(PDF_CONFIG.bodySize);
  }

  addMetadata(parts: string[]): void {
    if (parts.length === 0) return;
    this.doc.setFontSize(PDF_CONFIG.metaSize);
    this.setColor(PDF_CONFIG.metaColor);

    const lineHeight = getTextHeight(PDF_CONFIG.metaSize);
    this.ensureSpace(lineHeight);
    this.doc.text(parts.join(' | '), PDF_CONFIG.marginLeft, this.y);
    this.y += lineHeight + PDF_CONFIG.paragraphSpacing;

    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.setColor(PDF_CONFIG.textColor);
  }

  addHeading(content: InlineContent[], level: number, alignment?: TextAlignment): void {
    const headingIndex = Math.min(level - 1, PDF_CONFIG.headingSizes.length - 1);
    const fontSize = PDF_CONFIG.headingSizes[headingIndex] ?? PDF_CONFIG.bodySize;
    this.y += PDF_CONFIG.headingSpacing / 2;

    const spans = inlineContentToSpans(content).map((span) => ({ ...span, bold: true }));
    const lines = buildWrappedLines(this.doc, spans, this.contentWidth);
    const options = this.buildRenderLinesOptions(
      fontSize,
      PDF_CONFIG.marginLeft,
      this.contentWidth,
      alignment,
    );
    this.y = renderLines(this.doc, lines, this.y, options);
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addParagraph(content: InlineContent[], alignment?: TextAlignment): void {
    const spans = inlineContentToSpans(content);
    if (spans.every((s) => s.text.trim().length === 0)) return;

    const lines = buildWrappedLines(this.doc, spans, this.contentWidth);
    const options = this.buildRenderLinesOptions(
      PDF_CONFIG.bodySize,
      PDF_CONFIG.marginLeft,
      this.contentWidth,
      alignment,
    );
    this.y = renderLines(this.doc, lines, this.y, options);
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addListItem(content: InlineContent[], index: number, ordered: boolean): void {
    const prefix = this.getListPrefix(index, ordered);
    const lineHeight = getTextHeight(PDF_CONFIG.bodySize);

    this.ensureSpace(lineHeight);
    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);
    this.doc.text(prefix, PDF_CONFIG.marginLeft, this.y);

    const prefixWidth = this.doc.getTextWidth(prefix);
    const layout = this.getListLayout(prefixWidth);
    const lines = this.buildListLines(content, layout.contentWidth - layout.prefixWidth);

    this.renderListLines(lines, layout, lineHeight);
    resetTextStyle(this.doc);
  }

  endList(): void {
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addQuote(content: InlineContent[], alignment?: TextAlignment): void {
    const spans = inlineContentToSpans(content);
    if (spans.every((s) => s.text.trim().length === 0)) return;

    const quoteWidth = this.contentWidth - PDF_CONFIG.quoteIndent;
    const lineHeight = getTextHeight(PDF_CONFIG.bodySize);
    const estimatedHeight =
      wrapText(this.doc, spans.map((s) => s.text).join(''), quoteWidth).length * lineHeight;

    this.ensureSpace(estimatedHeight);

    // Left border
    this.setDrawColor(PDF_CONFIG.quoteBorder);
    this.doc.setLineWidth(QUOTE_BORDER_LINE_WIDTH);
    this.doc.line(
      PDF_CONFIG.marginLeft,
      this.y - lineHeight * DECORATION_OFFSET_RATIO,
      PDF_CONFIG.marginLeft,
      this.y + estimatedHeight - lineHeight * HALF_LINE_HEIGHT_RATIO,
    );

    const quotedSpans = spans.map((s) => ({
      ...s,
      italic: true,
      color: s.color ?? (PDF_CONFIG.metaColor as RGB),
    }));
    const quotedLines = buildWrappedLines(this.doc, quotedSpans, quoteWidth);
    const options = this.buildRenderLinesOptions(
      PDF_CONFIG.bodySize,
      PDF_CONFIG.marginLeft + PDF_CONFIG.quoteIndent,
      quoteWidth,
      alignment,
    );
    this.y = renderLines(this.doc, quotedLines, this.y, options);
    this.y += PDF_CONFIG.paragraphSpacing;

    resetTextStyle(this.doc);
  }

  addCodeBlock(code: string): void {
    if (code.trim().length === 0) return;

    this.doc.setFontSize(PDF_CONFIG.codeSize);
    this.doc.setFont('courier', 'normal');

    const codeWidth = this.contentWidth - PDF_CONFIG.codeIndent * 2;
    const codeLines = code
      .split('\n')
      .flatMap((line) => wrapText(this.doc, line.length === 0 ? ' ' : line, codeWidth));
    const lineHeight = getTextHeight(PDF_CONFIG.codeSize);
    const blockHeight = codeLines.length * lineHeight + PDF_CONFIG.codeIndent;

    this.ensureSpace(blockHeight);

    this.setFillColor(PDF_CONFIG.codeBackground);
    this.doc.rect(
      PDF_CONFIG.marginLeft,
      this.y - lineHeight * HALF_LINE_HEIGHT_RATIO,
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
