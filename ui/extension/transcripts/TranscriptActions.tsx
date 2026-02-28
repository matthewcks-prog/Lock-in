/**
 * Action bar rendered below a transcript message.
 *
 * Layout:
 * - Primary actions: Generate summary, Save note
 * - Secondary actions: More options menu (downloads)
 */

import type { MoreOptionsMenuItem } from './TranscriptMoreOptionsMenu';
import { TranscriptMoreOptionsMenu } from './TranscriptMoreOptionsMenu';
import { useGenerateSummary } from './useGenerateSummary';

const DOWNLOAD_ICON = '\uD83D\uDCE5';
const SAVE_ICON = '\uD83D\uDCBE';
const SUMMARY_ICON = '\u2728';

interface TranscriptActionsProps {
  onDownloadTxt: () => void;
  onDownloadVtt: () => void;
  onSave: () => void;
}

export function TranscriptActions({
  onDownloadTxt,
  onDownloadVtt,
  onSave,
}: TranscriptActionsProps): JSX.Element {
  const { generateSummary, isLoading } = useGenerateSummary();

  const moreItems: MoreOptionsMenuItem[] = [
    {
      id: 'download-txt',
      label: 'Download .txt',
      icon: DOWNLOAD_ICON,
      onClick: onDownloadTxt,
    },
    {
      id: 'download-vtt',
      label: 'Download .vtt',
      icon: DOWNLOAD_ICON,
      onClick: onDownloadVtt,
    },
  ];

  return (
    <div className="lockin-transcript-actions">
      <div className="lockin-transcript-actions-primary">
        <button
          aria-label="Generate summary"
          className="lockin-transcript-action-btn lockin-transcript-action-primary"
          disabled={isLoading}
          onClick={generateSummary}
          title="Generate summary"
          type="button"
        >
          {SUMMARY_ICON} Generate summary
        </button>
        <button
          className="lockin-transcript-action-btn lockin-transcript-action-primary"
          onClick={onSave}
          title="Save transcript as note"
          type="button"
        >
          {SAVE_ICON} Save note
        </button>
      </div>

      <TranscriptMoreOptionsMenu items={moreItems} />
    </div>
  );
}
