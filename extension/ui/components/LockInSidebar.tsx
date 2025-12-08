/**
 * Lock-in Extension Sidebar Component
 *
 * Main sidebar widget component for the Chrome extension.
 * Orchestrates Chat and Notes panels with modern React-based UI.
 */

import { useState, useEffect } from "react";
import { ChatPanel } from "./ChatPanel";
import { NotesPanel } from "./NotesPanel";
import { ChatHistoryPanel } from "./ChatHistoryPanel";
import { Tabs } from "@shared/ui/components/Tabs";
import type { ApiClient } from "@api/client";
import type { StudyMode, PageContext } from "@core/domain/types";

export interface LockInSidebarProps {
  apiClient: ApiClient;
  isOpen: boolean;
  onToggle: () => void;
  currentMode: StudyMode;
  selectedText?: string;
  pageContext?: PageContext;
  storage?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
}

export function LockInSidebar({
  apiClient,
  isOpen,
  onToggle,
  currentMode,
  selectedText,
  pageContext,
  storage,
}: LockInSidebarProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "notes">("chat");
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!storage) return;
    storage.get("lockin_sidebar_activeTab").then((tab: string) => {
      if (tab === "chat" || tab === "notes") {
        setActiveTab(tab);
      }
    });
  }, [storage]);

  useEffect(() => {
    if (!storage) return;
    storage.set("lockin_sidebar_activeTab", activeTab);
  }, [activeTab, storage]);

  const courseCode = pageContext?.courseContext.courseCode || null;
  const sourceUrl =
    pageContext?.url ||
    (typeof window !== "undefined" ? window.location.href : "");

  if (!isOpen) {
    return (
      <button
        id="lockin-toggle-pill"
        className="pointer-events-auto fixed bottom-8 right-6 z-[2147483646] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        onClick={onToggle}
        aria-label="Open Lock-in sidebar"
        title="Open Lock-in study assistant"
      >
        <span>Lock-in</span>
      </button>
    );
  }

  const tabs = [
    { id: "chat", label: "Chat" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <>
      <aside
        id="lockin-sidebar"
        className="fixed top-0 right-0 h-screen w-[30%] max-w-md flex flex-col bg-white shadow-xl pointer-events-auto"
        data-state="expanded"
        role="complementary"
        aria-label="Lock-in Study Assistant"
      >
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Mode</p>
              <p className="text-sm font-semibold text-gray-900 capitalize">
                {currentMode}
              </p>
            </div>
            <button
              className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              onClick={onToggle}
              aria-label="Close sidebar"
              title="Close"
            >
              X
            </button>
          </div>

          <div className="px-4 pb-2">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tabId) => {
                if (tabId === "chat" || tabId === "notes") {
                  setActiveTab(tabId);
                }
              }}
              variant="pill"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <button
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
                  onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
                  aria-label={
                    isHistoryPanelOpen ? "Hide history" : "Show history"
                  }
                  title={
                    isHistoryPanelOpen
                      ? "Hide chat history"
                      : "Show chat history"
                  }
                >
                  {isHistoryPanelOpen ? "<" : "="}
                </button>
                <span className="text-xs font-medium text-gray-600 flex-1">
                  {isHistoryPanelOpen ? "Chat History" : "Current Chat"}
                </span>
              </div>

              <div className="flex-1 overflow-hidden flex">
                {isHistoryPanelOpen && (
                  <div className="w-1/3 border-r border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
                    <ChatHistoryPanel
                      apiClient={apiClient}
                      currentChatId={currentChatId}
                      onChatSelect={(chatId) => {
                        setCurrentChatId(chatId);
                      }}
                      onNewChat={() => {
                        setCurrentChatId(null);
                      }}
                    />
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  <ChatPanel
                    apiClient={apiClient}
                    chatId={currentChatId}
                    onChatIdChange={setCurrentChatId}
                    currentMode={currentMode}
                    selectedText={selectedText}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="flex-1 overflow-hidden">
              <NotesPanel
                apiClient={apiClient}
                courseCode={courseCode}
                sourceUrl={sourceUrl}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
