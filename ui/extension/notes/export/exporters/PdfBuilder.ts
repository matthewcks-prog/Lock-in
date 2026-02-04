/**
 * PDF Builder
 *
 * Wraps jsPDF with layout logic for document generation.
 * Handles pagination, text wrapping, and consistent styling.
 */

import { PDF_CONFIG } from './pdfConfig';

// ============================================================================
// jsPDF Type Declarations
// ============================================================================

/**
 * Minimal type definition for jsPDF instance.
 * We only declare the methods we actually use to avoid dependency on @types/jspdf.
 */
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
  output(type: 'blob'): Blob;
}

export interface JsPDFConstructor {
  new (options: { orientation: string; unit: string; format: string }): JsPDFInstance;
}

// ============================================================================
// PDF Builder Class
// ============================================================================

/**
 * Simple PDF builder that wraps jsPDF with layout logic.
 * Single Responsibility: Building PDF documents with consistent styling.
 */
export class PdfBuilder {
  private doc: JsPDFInstance;
  private y: number;
  private contentWidth: number;

  constructor(JsPDFCtor: JsPDFConstructor) {
    this.doc = new JsPDFCtor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    this.y = PDF_CONFIG.marginTop;
    this.contentWidth = PDF_CONFIG.pageWidth - PDF_CONFIG.marginLeft - PDF_CONFIG.marginRight;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.setColor(PDF_CONFIG.textColor);
  }

  private setColor(color: [number, number, number]): void {
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  private setFillColor(color: [number, number, number]): void {
    this.doc.setFillColor(color[0], color[1], color[2]);
  }

  private setDrawColor(color: [number, number, number]): void {
    this.doc.setDrawColor(color[0], color[1], color[2]);
  }

  private checkPageBreak(height: number): void {
    const maxY = PDF_CONFIG.pageHeight - PDF_CONFIG.marginBottom;
    if (this.y + height > maxY) {
      this.doc.addPage();
      this.y = PDF_CONFIG.marginTop;
    }
  }

  private getTextHeight(fontSize: number): number {
    return fontSize * PDF_CONFIG.lineHeight * 0.352778; // pt to mm
  }

  private wrapText(text: string, maxWidth: number): string[] {
    return this.doc.splitTextToSize(text, maxWidth);
  }

  addTitle(title: string): void {
    this.doc.setFontSize(PDF_CONFIG.titleSize);
    this.doc.setFont('helvetica', 'bold');
    this.setColor(PDF_CONFIG.textColor);

    const lines = this.wrapText(title, this.contentWidth);
    const lineHeight = this.getTextHeight(PDF_CONFIG.titleSize);

    for (const line of lines) {
      this.checkPageBreak(lineHeight);
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

    const text = parts.join(' | ');
    const lineHeight = this.getTextHeight(PDF_CONFIG.metaSize);

    this.checkPageBreak(lineHeight);
    this.doc.text(text, PDF_CONFIG.marginLeft, this.y);
    this.y += lineHeight + PDF_CONFIG.paragraphSpacing;

    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.setColor(PDF_CONFIG.textColor);
  }

  addHeading(text: string, level: number): void {
    const sizeIndex = Math.min(level - 1, PDF_CONFIG.headingSizes.length - 1);
    const fontSize = PDF_CONFIG.headingSizes[sizeIndex];

    this.y += PDF_CONFIG.headingSpacing / 2;
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');
    this.setColor(PDF_CONFIG.textColor);

    const lines = this.wrapText(text, this.contentWidth);
    const lineHeight = this.getTextHeight(fontSize);

    for (const line of lines) {
      this.checkPageBreak(lineHeight);
      this.doc.text(line, PDF_CONFIG.marginLeft, this.y);
      this.y += lineHeight;
    }

    this.y += PDF_CONFIG.paragraphSpacing;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(PDF_CONFIG.bodySize);
  }

  addParagraph(text: string): void {
    if (!text.trim()) return;

    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);

    const lines = this.wrapText(text, this.contentWidth);
    const lineHeight = this.getTextHeight(PDF_CONFIG.bodySize);

    for (const line of lines) {
      this.checkPageBreak(lineHeight);
      this.doc.text(line, PDF_CONFIG.marginLeft, this.y);
      this.y += lineHeight;
    }

    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addListItem(text: string, index: number, ordered: boolean): void {
    const prefix = ordered ? `${index + 1}. ` : '\u2022 ';
    const indentedWidth = this.contentWidth - PDF_CONFIG.listIndent;

    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.setColor(PDF_CONFIG.textColor);

    const lines = this.wrapText(text, indentedWidth);
    const lineHeight = this.getTextHeight(PDF_CONFIG.bodySize);

    for (let i = 0; i < lines.length; i++) {
      this.checkPageBreak(lineHeight);
      const x = PDF_CONFIG.marginLeft + (i === 0 ? 0 : PDF_CONFIG.listIndent);
      const displayText = i === 0 ? prefix + lines[i] : lines[i];
      this.doc.text(displayText, x, this.y);
      this.y += lineHeight;
    }
  }

  endList(): void {
    this.y += PDF_CONFIG.paragraphSpacing;
  }

  addQuote(text: string): void {
    if (!text.trim()) return;

    const quoteWidth = this.contentWidth - PDF_CONFIG.quoteIndent;
    const lines = this.wrapText(text, quoteWidth);
    const lineHeight = this.getTextHeight(PDF_CONFIG.bodySize);
    const blockHeight = lines.length * lineHeight;

    this.checkPageBreak(blockHeight);

    // Draw left border
    this.setDrawColor(PDF_CONFIG.quoteBorder);
    this.doc.setLineWidth(0.5);
    this.doc.line(
      PDF_CONFIG.marginLeft,
      this.y - lineHeight * 0.3,
      PDF_CONFIG.marginLeft,
      this.y + blockHeight - lineHeight * 0.5,
    );

    // Draw text
    this.doc.setFontSize(PDF_CONFIG.bodySize);
    this.doc.setFont('helvetica', 'italic');
    this.setColor(PDF_CONFIG.metaColor);

    const x = PDF_CONFIG.marginLeft + PDF_CONFIG.quoteIndent;
    for (const line of lines) {
      this.doc.text(line, x, this.y);
      this.y += lineHeight;
    }

    this.y += PDF_CONFIG.paragraphSpacing;
    this.doc.setFont('helvetica', 'normal');
    this.setColor(PDF_CONFIG.textColor);
  }

  addCodeBlock(code: string): void {
    if (!code.trim()) return;

    this.doc.setFontSize(PDF_CONFIG.codeSize);
    this.doc.setFont('courier', 'normal');

    const codeWidth = this.contentWidth - PDF_CONFIG.codeIndent * 2;
    const codeLines: string[] = [];

    for (const line of code.split('\n')) {
      const wrapped = this.wrapText(line || ' ', codeWidth);
      codeLines.push(...wrapped);
    }

    const lineHeight = this.getTextHeight(PDF_CONFIG.codeSize);
    const blockHeight = codeLines.length * lineHeight + PDF_CONFIG.codeIndent;

    this.checkPageBreak(blockHeight);

    // Draw background
    this.setFillColor(PDF_CONFIG.codeBackground);
    this.doc.rect(
      PDF_CONFIG.marginLeft,
      this.y - lineHeight * 0.5,
      this.contentWidth,
      blockHeight,
      'F',
    );

    // Draw code
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
