import type { ReactNode } from 'react';
import { BLOCK_OPTIONS, type BlockType } from './noteToolbarConstants';

function Tooltip({ text, children }: { text: string; children: ReactNode }): JSX.Element {
  return (
    <span className="lockin-tooltip-wrapper">
      {children}
      <span className="lockin-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  swatchColor?: string | null;
}

export function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
  swatchColor,
}: ToolbarButtonProps): JSX.Element {
  return (
    <Tooltip text={label}>
      <button
        type="button"
        className={`lockin-note-tool-btn${active === true ? ' is-active' : ''}`}
        aria-pressed={active}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {children ?? label}
        {swatchColor !== null && swatchColor !== undefined && swatchColor.length > 0 && (
          <span
            className="lockin-tool-swatch"
            style={{
              background:
                swatchColor === 'transparent'
                  ? 'linear-gradient(135deg, #fff 45%, #f00 50%, #fff 55%)'
                  : swatchColor,
            }}
          />
        )}
      </button>
    </Tooltip>
  );
}

export function BlockTypeSelect({
  value,
  onChange,
}: {
  value: BlockType;
  onChange: (next: BlockType) => void;
}): JSX.Element {
  return (
    <select
      className="lockin-note-block-select"
      value={value}
      onChange={(event) => onChange(event.target.value as BlockType)}
      aria-label="Block type"
    >
      {BLOCK_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SwatchMenu({
  swatches,
  onSelect,
  label,
}: {
  swatches: string[];
  onSelect: (color: string) => void;
  label: string;
}): JSX.Element {
  return (
    <div className="lockin-note-color-menu" role="listbox" aria-label={label}>
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          className="lockin-color-swatch"
          style={{ background: color === 'transparent' ? 'white' : color }}
          onClick={() => onSelect(color)}
          aria-label={`${label} ${color}`}
        />
      ))}
    </div>
  );
}
