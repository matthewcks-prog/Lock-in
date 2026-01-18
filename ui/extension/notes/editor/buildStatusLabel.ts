import type { NoteStatus } from '@core/domain/Note';
import { relativeLabel } from '../utils/relativeTime';

export function buildStatusLabel({
  status,
  updatedAt,
  isAssetUploading,
  error,
}: {
  status: NoteStatus;
  updatedAt?: string | null;
  isAssetUploading?: boolean;
  error?: string | null;
}) {
  if (error) {
    return {
      label: error || 'Error saving - retry soon',
      tone: 'error' as const,
      spinner: false,
    };
  }
  if (status === 'error') {
    return {
      label: 'Error saving - retry soon',
      tone: 'error' as const,
      spinner: false,
    };
  }
  if (status === 'saving') {
    return { label: 'Saving...', tone: 'muted' as const, spinner: true };
  }
  if (isAssetUploading) {
    return {
      label: 'Uploading attachment...',
      tone: 'muted' as const,
      spinner: true,
    };
  }
  if (status === 'saved') {
    return {
      label: `Saved ${relativeLabel(updatedAt)}`,
      tone: 'success' as const,
      spinner: false,
    };
  }
  if (status === 'editing') {
    return { label: 'Editing...', tone: 'muted' as const, spinner: false };
  }
  return { label: 'Idle', tone: 'muted' as const, spinner: false };
}
