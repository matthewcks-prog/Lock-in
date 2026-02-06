import type { Dispatch, SetStateAction } from 'react';
import type { ChatHistoryItem, ChatMessage } from '../types';
import type { SendChatOptionsInput } from './chatSendOptions';

export interface UseChatReturn {
  // Current chat state
  activeChatId: string | null;
  activeHistoryId: string | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;

  // History
  recentChats: ChatHistoryItem[];
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  isLoadingMoreHistory: boolean;
  loadMoreHistory: () => Promise<unknown>;

  // Actions
  sendMessage: (message: string, options?: SendChatOptionsInput) => void;
  startNewChat: (text: string, options?: SendChatOptionsInput) => void;
  startBlankChat: () => void;
  selectChat: (item: ChatHistoryItem) => Promise<void>;
  ensureChatId: (initialMessage?: string) => Promise<string | null>;

  // Status
  isSending: boolean;
  error: Error | null;
  clearError: () => void;

  // History panel
  isHistoryOpen: boolean;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
}
