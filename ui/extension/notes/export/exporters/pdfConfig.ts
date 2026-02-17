/**
 * PDF Configuration Constants
 *
 * Centralized configuration for PDF document generation.
 */

const HEADING_SIZE_H1 = 16;
const HEADING_SIZE_H2 = 14;
const HEADING_SIZE_H3 = 13;
const HEADING_SIZE_H4 = 12;
const HEADING_SIZE_H5 = 11;
const HEADING_SIZE_H6 = 10;
const COLOR_TEXT_CHANNEL = 33;
const COLOR_CODE_BACKGROUND_CHANNEL = 245;
const COLOR_QUOTE_BORDER_CHANNEL = 200;

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
  headingSizes: [
    HEADING_SIZE_H1,
    HEADING_SIZE_H2,
    HEADING_SIZE_H3,
    HEADING_SIZE_H4,
    HEADING_SIZE_H5,
    HEADING_SIZE_H6,
  ] as const,
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
  textColor: [COLOR_TEXT_CHANNEL, COLOR_TEXT_CHANNEL, COLOR_TEXT_CHANNEL] as [
    number,
    number,
    number,
  ],
  metaColor: [100, 100, 100] as [number, number, number],
  codeBackground: [
    COLOR_CODE_BACKGROUND_CHANNEL,
    COLOR_CODE_BACKGROUND_CHANNEL,
    COLOR_CODE_BACKGROUND_CHANNEL,
  ] as [number, number, number],
  quoteBorder: [
    COLOR_QUOTE_BORDER_CHANNEL,
    COLOR_QUOTE_BORDER_CHANNEL,
    COLOR_QUOTE_BORDER_CHANNEL,
  ] as [number, number, number],
} as const;

export type PdfConfig = typeof PDF_CONFIG;
