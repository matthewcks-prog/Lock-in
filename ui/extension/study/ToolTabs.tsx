import { X } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

export interface ToolTabItem<T extends string = string> {
  id: T;
  title: string;
  closeable?: boolean;
}

interface ToolTabsProps<T extends string = string> {
  ariaLabel: string;
  idPrefix: string;
  tabs: ReadonlyArray<ToolTabItem<T>>;
  activeTabId: T | null;
  onActivateTab: (tabId: T) => void;
  onCloseTab: (tabId: T) => void;
}

interface ToolTabRowProps<T extends string = string> {
  tab: ToolTabItem<T>;
  idPrefix: string;
  isActive: boolean;
  onActivateTab: (tabId: T) => void;
  onCloseTab: (tabId: T) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: T, closeable: boolean) => void;
  onTabRef: (tabId: T, button: HTMLButtonElement | null) => void;
}

function resolveNextIndex(index: number, count: number, direction: -1 | 1): number {
  return (index + direction + count) % count;
}

function resolveNavigationTabId<T extends string = string>({
  key,
  tabs,
  tabId,
}: {
  key: string;
  tabs: ReadonlyArray<ToolTabItem<T>>;
  tabId: T;
}): T | null {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0 || tabs.length === 0) return null;
  if (key === 'ArrowRight') return tabs[resolveNextIndex(index, tabs.length, 1)]?.id ?? null;
  if (key === 'ArrowLeft') return tabs[resolveNextIndex(index, tabs.length, -1)]?.id ?? null;
  if (key === 'Home') return tabs[0]?.id ?? null;
  if (key === 'End') return tabs[tabs.length - 1]?.id ?? null;
  return null;
}

function shouldCloseActiveTab({
  key,
  isActive,
  closeable,
}: {
  key: string;
  isActive: boolean;
  closeable: boolean;
}): boolean {
  const isCloseShortcut = key === 'Delete' || key === 'Backspace';
  return isCloseShortcut && isActive && closeable;
}

function createTabKeyDownHandler<T extends string = string>({
  activeTabId,
  tabs,
  activateAndFocusTab,
  onCloseTab,
}: {
  activeTabId: T | null;
  tabs: ReadonlyArray<ToolTabItem<T>>;
  activateAndFocusTab: (tabId: T) => void;
  onCloseTab: (tabId: T) => void;
}): (event: KeyboardEvent<HTMLButtonElement>, tabId: T, closeable: boolean) => void {
  return (event, tabId, closeable) => {
    const navigationTabId = resolveNavigationTabId({ key: event.key, tabs, tabId });
    if (navigationTabId !== null) {
      event.preventDefault();
      activateAndFocusTab(navigationTabId);
      return;
    }
    if (shouldCloseActiveTab({ key: event.key, isActive: tabId === activeTabId, closeable })) {
      event.preventDefault();
      onCloseTab(tabId);
    }
  };
}

function ToolTabsEmpty(): JSX.Element {
  return (
    <div className="lockin-study-tool-tabs lockin-study-tool-tabs-empty">
      <span className="lockin-study-tool-tabs-copy">No study tools open</span>
    </div>
  );
}

function ToolTabRow<T extends string = string>({
  tab,
  idPrefix,
  isActive,
  onActivateTab,
  onCloseTab,
  onKeyDown,
  onTabRef,
}: ToolTabRowProps<T>): JSX.Element {
  const tabDomId = `${idPrefix}-tab-${tab.id}`;
  const panelDomId = `${idPrefix}-panel-${tab.id}`;

  return (
    <div className={`lockin-study-tool-tab${isActive ? ' is-active' : ''}`} role="presentation">
      <button
        id={tabDomId}
        type="button"
        role="tab"
        aria-controls={panelDomId}
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        className="lockin-study-tool-tab-trigger"
        onClick={() => onActivateTab(tab.id)}
        onKeyDown={(event) => onKeyDown(event, tab.id, tab.closeable !== false)}
        ref={(button) => onTabRef(tab.id, button)}
      >
        <span className="lockin-study-tool-tab-title">{tab.title}</span>
      </button>
      {tab.closeable !== false && (
        <button
          type="button"
          className="lockin-study-tool-tab-close"
          onClick={() => onCloseTab(tab.id)}
          aria-label={`Close ${tab.title}`}
          title={`Close ${tab.title}`}
        >
          <X size={10} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ToolTabs<T extends string = string>({
  ariaLabel,
  idPrefix,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
}: ToolTabsProps<T>): JSX.Element {
  const tabButtonRefs = useRef(new Map<T, HTMLButtonElement>());
  const focusTab = (tabId: T): void => tabButtonRefs.current.get(tabId)?.focus();
  const activateAndFocusTab = (tabId: T): void => {
    onActivateTab(tabId);
    focusTab(tabId);
  };
  const onTabRef = (tabId: T, button: HTMLButtonElement | null): void => {
    if (button === null) {
      tabButtonRefs.current.delete(tabId);
      return;
    }
    tabButtonRefs.current.set(tabId, button);
  };
  const onTabKeyDown = createTabKeyDownHandler({
    activeTabId,
    tabs,
    activateAndFocusTab,
    onCloseTab,
  });

  if (tabs.length === 0) return <ToolTabsEmpty />;

  return (
    <div className="lockin-study-tool-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <ToolTabRow
          key={tab.id}
          tab={tab}
          idPrefix={idPrefix}
          isActive={tab.id === activeTabId}
          onActivateTab={onActivateTab}
          onCloseTab={onCloseTab}
          onKeyDown={onTabKeyDown}
          onTabRef={onTabRef}
        />
      ))}
    </div>
  );
}
