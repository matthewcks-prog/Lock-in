/**
 * Export Metadata Helpers
 *
 * Shared helpers for rendering note metadata across exporters.
 */

import type { ExportMetadata } from './types';

export interface MetadataField {
  label: string;
  value: string;
}

export function buildMetadataFields(metadata: ExportMetadata): MetadataField[] {
  const fields: MetadataField[] = [];

  if (
    metadata.courseCode !== undefined &&
    metadata.courseCode !== null &&
    metadata.courseCode.length > 0
  ) {
    fields.push({ label: 'Course', value: metadata.courseCode });
  }

  if (metadata.week !== undefined && metadata.week !== null) {
    fields.push({ label: 'Week', value: String(metadata.week) });
  }

  return fields;
}
