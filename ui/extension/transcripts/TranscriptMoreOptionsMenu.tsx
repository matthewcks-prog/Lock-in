/**
 * TranscriptMoreOptionsMenu
 *
 * Renders the "More options" trigger button and its accessible dropdown menu.
 * All open/close, keyboard, and focus behaviour lives in useMoreOptionsMenu.
 * Designed to be extended with additional menu items without changing structure.
 */

import { useMoreOptionsMenu } from './useMoreOptionsMenu';

const MORE_LABEL = '\u22EF More'; // ⋯ More

export interface MoreOptionsMenuItem {
  /** Stable identifier used as React key. */
  id: string;
  label: string;
  /** Optional emoji / icon character shown before the label. */
  icon?: string;
  onClick: () => void;
}

interface TranscriptMoreOptionsMenuProps {
  items: MoreOptionsMenuItem[];
}

export function TranscriptMoreOptionsMenu({ items }: TranscriptMoreOptionsMenuProps): JSX.Element {
  const { isOpen, triggerRef, menuRef, close, toggle } = useMoreOptionsMenu();

  function handleItemClick(item: MoreOptionsMenuItem): void {
    item.onClick();
    close();
  }

  return (
    <div className="lockin-transcript-more-options">
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="lockin-transcript-action-btn lockin-transcript-more-btn"
        onClick={toggle}
        title="More options"
        type="button"
      >
        {MORE_LABEL}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          aria-label="More options"
          className="lockin-transcript-more-menu"
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.id}
              className="lockin-transcript-more-menu-item"
              onClick={() => handleItemClick(item)}
              role="menuitem"
              type="button"
            >
              {item.icon !== undefined && (
                <span aria-hidden="true" className="lockin-transcript-more-menu-item-icon">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
