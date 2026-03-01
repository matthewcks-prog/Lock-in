/**
 * TranscriptTimestampsToggle
 *
 * Presentational toggle to show/hide transcript timestamps.
 * Controlled component: parent owns state.
 */

export interface TranscriptTimestampsToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Optional id for the checkbox (for aria-describedby etc.). */
  id?: string;
}

export function TranscriptTimestampsToggle({
  checked,
  onCheckedChange,
  id = 'lockin-transcript-show-timestamps',
}: TranscriptTimestampsToggleProps): JSX.Element {
  return (
    <label className="lockin-transcript-timestamps-toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label="Show timestamps"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="lockin-transcript-timestamps-toggle-input"
      />
      <span className="lockin-transcript-timestamps-toggle-label">Show timestamps</span>
    </label>
  );
}
