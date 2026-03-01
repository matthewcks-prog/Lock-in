import type { ReactNode } from 'react';
import { ToolTabs, type ToolTabItem } from './ToolTabs';

export interface ToolPanelTab<T extends string = string> extends ToolTabItem<T> {}

interface ToolPanelLayoutProps<T extends string = string> {
  ariaLabel: string;
  idPrefix: string;
  tabs: ReadonlyArray<ToolPanelTab<T>>;
  activeTabId: T | null;
  onActivateTab: (tabId: T) => void;
  onCloseTab: (tabId: T) => void;
  renderContent: (tabId: T) => ReactNode;
  renderActions?: (tabId: T) => ReactNode;
  emptyState: ReactNode;
}

interface ToolPanelSectionsProps<T extends string = string> {
  idPrefix: string;
  tabs: ReadonlyArray<ToolPanelTab<T>>;
  activeTabId: T | null;
  renderContent: (tabId: T) => ReactNode;
  renderActions?: (tabId: T) => ReactNode;
}

function resolveActiveTabId<T extends string = string>({
  activeTabId,
  tabs,
}: {
  activeTabId: T | null;
  tabs: ReadonlyArray<ToolPanelTab<T>>;
}): T | null {
  if (tabs.length === 0) return null;
  if (activeTabId !== null && tabs.some((tab) => tab.id === activeTabId)) {
    return activeTabId;
  }
  return tabs[0]?.id ?? null;
}

function ToolPanelSections<T extends string = string>({
  idPrefix,
  tabs,
  activeTabId,
  renderContent,
  renderActions,
}: ToolPanelSectionsProps<T>): JSX.Element {
  return (
    <div className="lockin-study-tool-panels">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        const actions = renderActions?.(tab.id) ?? null;

        return (
          <section
            key={tab.id}
            id={`${idPrefix}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-tab-${tab.id}`}
            className={`lockin-study-tool-panel${isActive ? ' is-active' : ''}`}
            hidden={!isActive}
          >
            <div className="lockin-study-tool-panel-content">{renderContent(tab.id)}</div>
            {actions !== null && <div className="lockin-study-tool-panel-actions">{actions}</div>}
          </section>
        );
      })}
    </div>
  );
}

export function ToolPanelLayout<T extends string = string>({
  ariaLabel,
  idPrefix,
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  renderContent,
  renderActions,
  emptyState,
}: ToolPanelLayoutProps<T>): JSX.Element {
  const resolvedActiveTabId = resolveActiveTabId({ activeTabId, tabs });

  return (
    <div className="lockin-study-tool-layout">
      <ToolTabs
        ariaLabel={ariaLabel}
        idPrefix={idPrefix}
        tabs={tabs}
        activeTabId={resolvedActiveTabId}
        onActivateTab={onActivateTab}
        onCloseTab={onCloseTab}
      />

      <div className="lockin-study-tool-panel-shell">
        {tabs.length === 0 ? (
          <div className="lockin-study-tool-panel-empty">{emptyState}</div>
        ) : (
          <ToolPanelSections
            idPrefix={idPrefix}
            tabs={tabs}
            activeTabId={resolvedActiveTabId}
            renderContent={renderContent}
            {...(renderActions !== undefined ? { renderActions } : {})}
          />
        )}
      </div>
    </div>
  );
}
