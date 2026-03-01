import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { useStudyWorkspace } from './StudyWorkspaceContext';
import { STUDY_TOOLS } from './studyToolRegistry';

interface StudyToolsDropdownState {
  isOpen: boolean;
  containerRef: RefObject<HTMLDivElement>;
  menuRef: RefObject<HTMLDivElement>;
  close: () => void;
  toggle: () => void;
  handleMenuKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}

const STUDY_TOOLS_MENU_ID = 'lockin-study-tools-menu';

function useCloseOnOutsideClick({
  isOpen,
  containerRef,
  onClose,
}: {
  isOpen: boolean;
  containerRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}): void {
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target) === true) return;
      onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [containerRef, isOpen, onClose]);
}

function useCloseOnEscape({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }): void {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
}

function useFocusFirstMenuItem({
  isOpen,
  menuRef,
}: {
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement>;
}): void {
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [isOpen, menuRef]);
}

function focusNextMenuItem({
  event,
  menuRef,
}: {
  event: ReactKeyboardEvent<HTMLDivElement>;
  menuRef: RefObject<HTMLDivElement>;
}): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
  if (items === undefined) return;
  const buttons = Array.from(items);
  if (buttons.length === 0) return;

  event.preventDefault();
  const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex =
    event.key === 'ArrowDown'
      ? (currentIndex + 1) % buttons.length
      : (currentIndex - 1 + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus();
}

function useStudyToolsDropdown(): StudyToolsDropdownState {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => focusNextMenuItem({ event, menuRef }),
    [menuRef],
  );

  useCloseOnOutsideClick({ isOpen, containerRef, onClose: close });
  useCloseOnEscape({ isOpen, onClose: close });
  useFocusFirstMenuItem({ isOpen, menuRef });

  return { isOpen, containerRef, menuRef, close, toggle, handleMenuKeyDown };
}

function useStudyToolClick(
  openToolTab: ReturnType<typeof useStudyWorkspace>['openToolTab'],
  close: () => void,
): (toolId: Parameters<typeof openToolTab>[0]) => void {
  return useCallback(
    (toolId: Parameters<typeof openToolTab>[0]) => {
      openToolTab(toolId);
      close();
    },
    [close, openToolTab],
  );
}

function StudyToolsMenuList({
  isOpen,
  menuRef,
  onMenuKeyDown,
  onToolClick,
}: {
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement>;
  onMenuKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onToolClick: (toolId: (typeof STUDY_TOOLS)[number]['id']) => void;
}): JSX.Element | null {
  if (!isOpen) return null;
  return (
    <div
      id={STUDY_TOOLS_MENU_ID}
      className="lockin-study-tools-menu"
      role="menu"
      ref={menuRef}
      onKeyDown={onMenuKeyDown}
    >
      {STUDY_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className="lockin-study-tools-item"
          onClick={() => onToolClick(tool.id)}
          role="menuitem"
        >
          {tool.menuLabel}
        </button>
      ))}
    </div>
  );
}

export function StudyToolsMenu(): JSX.Element {
  const { openToolTab } = useStudyWorkspace();
  const { isOpen, containerRef, menuRef, close, toggle, handleMenuKeyDown } =
    useStudyToolsDropdown();
  const handleToolClick = useStudyToolClick(openToolTab, close);
  return (
    <div className="lockin-study-tools-container" ref={containerRef}>
      <button
        type="button"
        className="lockin-btn-new lockin-study-tools-btn"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? STUDY_TOOLS_MENU_ID : undefined}
      >
        <span className="lockin-study-tools-btn-label">Study Tools</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className="lockin-study-tools-chevron"
          aria-hidden="true"
        />
      </button>
      <StudyToolsMenuList
        isOpen={isOpen}
        menuRef={menuRef}
        onMenuKeyDown={handleMenuKeyDown}
        onToolClick={handleToolClick}
      />
    </div>
  );
}
