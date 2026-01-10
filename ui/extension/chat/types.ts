/**
 * Chat Domain Types
 *
 * Shared type definitions for the chat feature.
 * Used by hooks, components, and API layer.
 */

import type { StudyMode } from '../../../core/domain/types';

// =============================================================================
// Message Types
// =============================================================================

export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessage {
    id: string;
    role: ChatMessageRole;
    content: string;
    timestamp: string;
    mode?: StudyMode;
    source?: 'selection' | 'followup';
    isPending?: boolean;
}

// =============================================================================
// Chat Session Types
// =============================================================================

export interface ChatHistoryItem {
    id: string;
    title: string;
    updatedAt: string;
    lastMessage?: string;
}

export type HistoryTitleSource = 'local' | 'server';

// =============================================================================
// API Parameter Types
// =============================================================================

export interface SendMessageParams {
    /** The message content to send */
    message: string;
    /** Current study mode */
    mode: StudyMode;
    /** Source of the message */
    source: 'selection' | 'followup';
    /** Current page URL for context */
    pageUrl?: string;
    /** Course code if available */
    courseCode?: string;
    /** Existing chat ID if continuing conversation */
    chatId?: string | null;
    /** Chat history for context */
    chatHistory?: Array<{ role: string; content: string }>;
}

export interface ChatApiResponse {
    explanation: string;
    chatId?: string;
    chatTitle?: string;
}

// =============================================================================
// Hook Option Types
// =============================================================================

export interface UseChatOptions {
    /** API client for backend calls */
    apiClient: any | null;
    /** Storage adapter for persistence */
    storage?: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
    };
    /** Current study mode */
    mode: StudyMode;
    /** Current page URL */
    pageUrl: string;
    /** Course code if available */
    courseCode: string | null;
    /** Selected text from page (triggers new chat) */
    selectedText?: string;
}

export interface UseChatMessagesOptions {
    apiClient: any | null;
    chatId: string | null;
    mode: StudyMode;
}

export interface UseChatHistoryOptions {
    apiClient: any | null;
    limit?: number;
}

export interface UseSendMessageOptions {
    apiClient: any | null;
    mode: StudyMode;
    pageUrl: string;
    courseCode: string | null;
    onSuccess?: (response: ChatApiResponse, chatId: string) => void;
    onError?: (error: Error) => void;
}

// =============================================================================
// Constants
// =============================================================================

export const CHAT_TITLE_MAX_WORDS = 6;
export const CHAT_TITLE_MAX_LENGTH = 80;
export const FALLBACK_CHAT_TITLE = 'New chat';
export const ACTIVE_CHAT_ID_KEY = 'lockin_sidebar_activeChatId';

// =============================================================================
// Utility Functions
// =============================================================================

export function isValidUUID(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeSpaces(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

export function clampChatTitle(text = ''): string {
    const normalized = normalizeSpaces(text);
    if (!normalized) return '';

    const limitedWords = normalized.split(' ').slice(0, CHAT_TITLE_MAX_WORDS).join(' ').trim();

    if (limitedWords.length <= CHAT_TITLE_MAX_LENGTH) {
        return limitedWords;
    }

    return limitedWords.slice(0, CHAT_TITLE_MAX_LENGTH).trim();
}

export function coerceChatTitle(candidate?: string | null, fallback?: string): string {
    const normalizedCandidate = clampChatTitle(candidate || '');
    if (normalizedCandidate) return normalizedCandidate;

    const normalizedFallback = clampChatTitle(fallback || '');
    return normalizedFallback || FALLBACK_CHAT_TITLE;
}

export function buildInitialChatTitle(text: string): string {
    return coerceChatTitle(text, FALLBACK_CHAT_TITLE);
}

export function relativeTimeLabel(iso: string | null | undefined): string {
    if (!iso) return 'just now';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'just now';
    const delta = Date.now() - date.getTime();
    const minutes = Math.round(delta / 60000);
    if (minutes <= 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}
