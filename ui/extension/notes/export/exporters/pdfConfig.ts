/**
 * PDF Configuration Constants
 *
 * Centralized configuration for PDF document generation.
 */

export const PDF_CONFIG = {
  // Page settings (A4 in mm)
  pageWidth: 210,
  pageHeight: 297,
  marginLeft: 20,
  marginRight: 20,
  marginTop: 25,
  marginBottom: 25,

  // Font sizes (in points)
  titleSize: 18,
  headingSizes: [16, 14, 13, 12, 11, 10] as const,
  bodySize: 11,
  metaSize: 9,
  codeSize: 10,

  // Line heights (multiplier of font size)
  lineHeight: 1.4,
  paragraphSpacing: 6,
  headingSpacing: 10,

  // Indentation (in mm)
  listIndent: 8,
  quoteIndent: 10,
  codeIndent: 5,

  // Colors [R, G, B]
  textColor: [33, 33, 33] as [number, number, number],
  metaColor: [100, 100, 100] as [number, number, number],
  codeBackground: [245, 245, 245] as [number, number, number],
  quoteBorder: [200, 200, 200] as [number, number, number],
} as const;

export type PdfConfig = typeof PDF_CONFIG;
