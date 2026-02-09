import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  wrapper?: ComponentType<PropsWithChildren>;
  queryClient?: QueryClient;
  queryClientConfig?: QueryClientConfig;
  withQueryClient?: boolean;
};

export function createTestQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    ...config,
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup>; queryClient: QueryClient } {
  const {
    wrapper: OuterWrapper,
    queryClient,
    queryClientConfig,
    withQueryClient = true,
    ...renderOptions
  } = options;

  const client = queryClient ?? createTestQueryClient(queryClientConfig);

  function Providers({ children }: PropsWithChildren) {
    let content = children;
    if (withQueryClient) {
      content = <QueryClientProvider client={client}>{content}</QueryClientProvider>;
    }
    if (OuterWrapper) {
      content = <OuterWrapper>{content}</OuterWrapper>;
    }
    return <>{content}</>;
  }

  const user = userEvent.setup();
  return {
    user,
    queryClient: client,
    ...render(ui, { wrapper: Providers, ...renderOptions }),
  };
}
