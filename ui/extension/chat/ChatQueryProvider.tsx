/**
 * Chat Query Provider
 *
 * Provides QueryClient for TanStack Query with configuration
 * optimized for chat functionality.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const STALE_TIME_MINUTES = 5;
const GC_TIME_MINUTES = 30;
const QUERY_RETRY_BASE_DELAY_MS = 500;
const QUERY_RETRY_MAX_DELAY_MS = 5000;
const MUTATION_RETRY_DELAY_MS = 500;

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
        staleTime: STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
        gcTime: GC_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
        retry: 2,
        retryDelay: (attemptIndex) =>
          Math.min(QUERY_RETRY_BASE_DELAY_MS * 2 ** attemptIndex, QUERY_RETRY_MAX_DELAY_MS),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        retryDelay: MUTATION_RETRY_DELAY_MS,
      },
    },
  });
}

/**
 * Provider component that wraps children with QueryClientProvider.
 * Creates a stable QueryClient instance per component lifecycle.
 */
export function ChatQueryProvider({ children }: ChatQueryProviderProps): JSX.Element {
  const queryClient = useMemo(() => createChatQueryClient(), []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Export for direct access when needed
export { QueryClient, QueryClientProvider };
