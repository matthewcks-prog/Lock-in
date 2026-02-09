# UI Testing Guidelines (RTL)

Use React Testing Library (RTL) for all UI and hook tests. Focus on user-visible behavior and accessibility.

## Query Priority

1. `getByRole` / `findByRole`
2. `getByLabelText` / `findByLabelText`
3. `getByText` / `findByText`
4. `getByPlaceholderText` / `findByPlaceholderText`
5. `getByTestId` (last resort)

## Interaction Pattern

- Use `@testing-library/user-event` for all interactions.
- Avoid `fireEvent` except for low-level events that user-event cannot model.

## Async Patterns

- Prefer `findBy*` for async UI updates.
- Use `waitFor` when asserting state after async effects.
- Avoid manual `setTimeout` / `flushPromises` patterns.

## Test Entry Points

- **Setup:** `tests/setupTests.ts` (jest-dom, MSW lifecycle, DOM/polyfill stubs)
- **Render:** `shared/test/renderWithProviders.tsx`
  - Provides a fresh QueryClient by default (no retries).
  - Returns `user` for interactions.

## Mocking Strategy

- **UI tests:** mock API client calls or use MSW handlers for integration-style tests.
- **No real network calls:** all HTTP must be mocked.
- **Keep mocks close to tests:** add MSW handlers in `shared/test/msw/handlers.ts` or override in-test.

## Accessibility

- Ensure interactive elements have accessible names (labels, aria-labels).
- Prefer semantic elements (`button`, `input`, `textarea`) over non-semantic divs.

## Examples

```tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@shared/test';

const { user } = renderWithProviders(<MyComponent />);
await user.click(screen.getByRole('button', { name: /save/i }));
expect(await screen.findByText(/saved/i)).toBeInTheDocument();
```
