/**
 * PDF Exporter
 *
 * Converts normalized documents to PDF format using jsPDF.
 * Produces clean, well-formatted documents with proper typography.
 */

import type { Exporter, ExportMetadata, NormalizedDocument } from '../types';
import { buildMetadataFields } from '../metadata';
import { flattenInlineContent } from '../normalizer';
import { JsPDFConstructor, PdfBuilder } from './PdfBuilder';

// ============================================================================
// jsPDF Module Resolution
// ============================================================================

function resolveJsPdfConstructor(module: unknown): JsPDFConstructor {
  if (!module || typeof module !== 'object') {
    throw new Error('jsPDF module did not load correctly.');
  }

  const candidate = (module as { jsPDF?: unknown }).jsPDF;
  if (typeof candidate !== 'function') {
    throw new Error('jsPDF constructor was not found in the module.');
  }

  return candidate as JsPDFConstructor;
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Generates a PDF from the normalized document.
 */
async function generatePdf(document: NormalizedDocument, metadata: ExportMetadata): Promise<Blob> {
  // Dynamically import jsPDF to keep bundle size down when not exporting
  const jspdfModule = await import('jspdf');
  const JsPDF = resolveJsPdfConstructor(jspdfModule);

  const builder = new PdfBuilder(JsPDF);

  // Add title
  if (metadata.title) {
    builder.addTitle(metadata.title);
  }

  // Add metadata
  const metadataFields = buildMetadataFields(metadata);
  builder.addMetadata(metadataFields.map(({ label, value }) => `${label}: ${value}`));

  // Process blocks
  for (const block of document.blocks) {
    switch (block.type) {
      case 'paragraph': {
        const text = flattenInlineContent(block.children);
        builder.addParagraph(text);
        break;
      }

      case 'heading': {
        const text = flattenInlineContent(block.children);
        builder.addHeading(text, block.level);
        break;
      }

      case 'list': {
        for (let i = 0; i < block.children.length; i++) {
          const item = block.children[i];
          const text = flattenInlineContent(item.children);
          builder.addListItem(text, i, block.ordered);
        }
        builder.endList();
        break;
      }

      case 'quote': {
        const text = flattenInlineContent(block.children);
        builder.addQuote(text);
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
