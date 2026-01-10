/**
 * Chat Query Provider
 *
 * Provides QueryClient for TanStack Query with configuration
 * optimized for chat functionality.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';

interface ChatQueryProviderProps {
  children: ReactNode;
}

/**
 * Creates a QueryClient with chat-optimized defaults.
 * - Retry: 2 attempts with exponential backoff
 * - Stale time: 5 minutes (chats don't change frequently)
 * - GC time: 30 minutes (keep cache for session)
 */
function createChatQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        retryDelay: 500,
      },
    },
  });
}

/**
 * Provider component that wraps children with QueryClientProvider.
 * Creates a stable QueryClient instance per component lifecycle.
 */
export function ChatQueryProvider({ children }: ChatQueryProviderProps) {
  const queryClient = useMemo(() => createChatQueryClient(), []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Export for direct access when needed
export { QueryClient, QueryClientProvider };
