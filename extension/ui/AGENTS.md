# Extension UI Layer AGENTS.md

## Purpose

The `/extension/ui` directory contains React components and hooks for the **Lock-in extension sidebar widget**. These components are **extension-specific** and are NOT shared with the future web app.

The source files are in `/extension/ui` and are built to `/extension/ui/index.js` for use by the extension content script.

The future web app will have its own UI components in `/web` with full-page layouts (dashboard, notes library, calendar, etc.), not reusing this sidebar widget.

---

## Structure

```
/extension/ui (source files - built to /extension/ui/index.js)
  /components       → Extension sidebar React components (LockInSidebar, ChatPanel, NotesPanel, etc.)
  /hooks           → React hooks for sidebar functionality (useChat, useNotes, useChatHistory)
  index.tsx        → Entry point, exports components and mount utilities
  global.css       → Global styles and Tailwind directives

/shared/ui (shared basic components)
  /components      → Basic reusable components (Button, Card, TextInput, Tabs)
                    Used by both extension and future web app

/extension/ui (built output)
  index.js         → Built bundle loaded by content script
  index.js.map     → Source map
```

**Important**: Extension UI components are extension-specific. The web app will have its own UI in `/web`. Basic components are shared via `/shared/ui`.

---

## Components

### `LockInSidebar.tsx`
- **Main sidebar component** - Single widget used across all sites
- Props: `apiClient`, `isOpen`, `onToggle`, `currentMode`, `selectedText`, `pageContext`, `storage`
- Handles tab switching (Chat/Notes), history panel, responsive behavior
- **DO NOT** create site-specific variants - use adapters for site differences

### `ChatPanel.tsx`
- Chat interface with messages and input form
- Uses `useChat` hook for state management
- Displays messages, loading states, errors

### `NotesPanel.tsx`
- Notes editor and list view
- Uses `useNotes` hook for state management
- Handles note CRUD operations, filtering, search

### `ChatHistoryPanel.tsx`
- List of recent chats
- Uses `useChatHistory` hook
- Handles chat selection and deletion

---

## Hooks

### `useChat.ts`
- Manages chat messages, loading, errors
- Handles sending messages, loading chat history
- Returns: `messages`, `isLoading`, `error`, `sendMessage`, `clearMessages`, `loadChatHistory`

### `useNotes.ts`
- Manages notes state, filtering, CRUD operations
- Handles active note editing, auto-save
- Returns: `activeNote`, `notes`, `createNote`, `saveNote`, `deleteNote`, etc.

### `useChatHistory.ts`
- Manages recent chats list
- Handles loading and deleting chats
- Returns: `chats`, `isLoading`, `loadChats`, `deleteChat`

---

## Usage in Extension

### Mounting React Components

```typescript
import { createLockInSidebar } from './extension/ui/index';

const { root, unmount } = createLockInSidebar({
  apiClient,
  isOpen: true,
  onToggle: () => {},
  currentMode: 'explain',
  selectedText: '...',
  pageContext: adapter.getPageContext(document, window.location.href),
  storage: chromeStorage,
});
```

### Building

```bash
npm run build:extension
```

This builds React components to `extension/ui/index.js` (IIFE format) that can be loaded by content scripts.

---

## Rules

### ✅ DO

- Use React hooks for state management
- Keep components small and focused
- Use TypeScript types from `/core/domain/types.ts`
- Use API client from `/api/client.ts` (injected via props)
- Keep components Chrome-agnostic in terms of APIs (no `chrome.*` APIs in components)
- Import shared UI components from `@shared/ui/components`
- Remember these are extension-specific sidebar components, not shared UI

### ❌ DON'T

- Create site-specific component variants
- Use global variables for state
- Build HTML strings - use JSX
- Import Chrome APIs directly
- Mix business logic with UI code
- Assume these components will be reused by the web app (they won't be)

---

## Adding New Components

1. Create component in `/extension/ui/components/ComponentName.tsx`
2. Export from `/extension/ui/index.tsx`
3. Build process will output to `/extension/ui/index.js`
4. Use TypeScript types from `/core/domain/types.ts`
5. Use hooks for state management
6. Keep component focused (single responsibility)
7. Remember: These are extension sidebar components, not shared UI

---

## Styling

- Use Tailwind CSS classes (via global.css)
- Components should work with existing styles
- Global styles are in `extension/ui/global.css`

---

## Testing

- Components can be tested in isolation (no Chrome APIs)
- Use React Testing Library for component tests
- Mock API client for hook tests
- Remember: These are extension-specific components, not shared UI

---

## Questions?

- Check `/core/domain/types.ts` for types
- Check `/api/client.ts` for API methods
- Check `/AGENTS.md` for project-level rules
