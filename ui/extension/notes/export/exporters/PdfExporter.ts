/**
 * PDF Exporter
 *
 * Converts normalized documents to PDF format using jsPDF.
 * Produces clean, well-formatted documents with proper typography.
 * Supports rich text formatting including colors, highlighting, and alignment.
 */

import type { Exporter, ExportMetadata, NormalizedDocument } from '../types';
import { buildMetadataFields } from '../metadata';
import { PdfBuilder } from './PdfBuilder';
import type { JsPDFConstructor } from './pdfTypes';

// ============================================================================
// jsPDF Module Resolution
// ============================================================================

function resolveJsPdfConstructor(module: unknown): JsPDFConstructor {
  if (module === null || module === undefined || typeof module !== 'object') {
    throw new Error('jsPDF module did not load correctly.');
  }

  const candidate = (module as { jsPDF?: unknown }).jsPDF;
  if (typeof candidate !== 'function') {
    throw new Error('jsPDF constructor was not found in the module.');
  }

  return candidate as JsPDFConstructor;
}

function getTitleLine(title: string): string | null {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function addMetadata(builder: PdfBuilder, metadata: ExportMetadata): void {
  const metadataFields = buildMetadataFields(metadata);
  builder.addMetadata(metadataFields.map(({ label, value }) => `${label}: ${value}`));
}

function addBlocks(builder: PdfBuilder, document: NormalizedDocument): void {
  for (const block of document.blocks) {
    switch (block.type) {
      case 'paragraph': {
        builder.addParagraph(block.children, block.alignment);
        break;
      }

      case 'heading': {
        builder.addHeading(block.children, block.level, block.alignment);
        break;
      }

      case 'list': {
        block.children.forEach((item, index) => {
          builder.addListItem(item.children, index, block.ordered);
        });
        builder.endList();
        break;
      }

      case 'quote': {
        builder.addQuote(block.children, block.alignment);
        break;
      }

      case 'code': {
        builder.addCodeBlock(block.code);
        break;
      }

      case 'linebreak': {
        builder.addLineBreak();
        break;
      }
    }
  }
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Generates a PDF from the normalized document.
 * Preserves rich text formatting including colors, highlighting, and alignment.
 */
async function generatePdf(document: NormalizedDocument, metadata: ExportMetadata): Promise<Blob> {
  // Dynamically import jsPDF to keep bundle size down when not exporting
  const jspdfModule = await import('jspdf');
  const JsPDF = resolveJsPdfConstructor(jspdfModule);

  const builder = new PdfBuilder(JsPDF);

  // Add title
  const titleLine = getTitleLine(metadata.title);
  if (titleLine !== null) builder.addTitle(titleLine);

  // Add metadata
  addMetadata(builder, metadata);

  // Process blocks with rich text support
  addBlocks(builder, document);

  return builder.toBlob();
}

// ============================================================================
// Exporter Implementation
// ============================================================================

/**
 * PDF exporter implementation using jsPDF.
 * Follows Strategy pattern for extensibility.
 */
export class PdfExporter implements Exporter {
  readonly format = 'pdf' as const;
  readonly extension = 'pdf';
  readonly mimeType = 'application/pdf';

  async export(document: NormalizedDocument, metadata: ExportMetadata): Promise<Blob> {
    return generatePdf(document, metadata);
  }
}
