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

  if (metadata.courseCode) {
    fields.push({ label: 'Course', value: metadata.courseCode });
  }

  if (metadata.week) {
    fields.push({ label: 'Week', value: String(metadata.week) });
  }

  return fields;
}
