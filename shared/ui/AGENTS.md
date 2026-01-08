# Shared UI Components AGENTS.md

## Purpose

The `/shared/ui` directory contains **basic, reusable UI components** that can be used by both the Chrome extension and the future web app.

These are low-level UI primitives (Button, Card, TextInput, Tabs) that provide consistent styling and behavior across surfaces.

---

## Structure

```
/shared/ui
  /components
    Button.tsx      → Reusable button with variants
    Card.tsx        → Card container component
    TextInput.tsx   → Text input with label/error support
    Tabs.tsx        → Tabbed interface component
    index.ts        → Barrel export
```

---

## Components

### `Button.tsx`

- Reusable button with variants (primary, secondary, ghost, danger)
- Sizes: sm, md, lg
- Loading state support
- Accessible and keyboard-friendly

### `Card.tsx`

- Container component for content
- Optional active state
- Clickable variant

### `TextInput.tsx`

- Text input with optional label
- Error and helper text support
- Accessible form input

### `Tabs.tsx`

- Tabbed interface component
- Variants: line, pill
- Accessible tab navigation

---

## Usage

### In Extension

```typescript
import { Button, Card, Tabs } from "@shared/ui/components";

function MyComponent() {
  return (
    <Card>
      <Button variant="primary">Click me</Button>
    </Card>
  );
}
```

### In Web App (future)

```typescript
import { Button, Card, TextInput } from '@shared/ui/components';
// Same API, consistent styling
```

---

## Rules

### ✅ DO

- Keep components simple and focused
- Use Tailwind CSS for styling
- Prefer accessible defaults (labels bound via `htmlFor`/`id`, aria attributes for error/helper text, roving tab indexes for
  composite widgets)
- Make components accessible (ARIA labels, keyboard navigation)
- Export types for props
- Keep components framework-agnostic (React only, no Chrome/Next.js specifics)

### ❌ DON'T

- Add business logic to these components
- Make components specific to extension or web app
- Use Chrome APIs or Next.js-specific features
- Create high-level components (those go in ui/extension or web/)
- Mix styling approaches (use Tailwind consistently)

---

## Adding New Components

1. Create component in `/shared/ui/components/ComponentName.tsx`
2. Export from `/shared/ui/components/index.ts`
3. Use Tailwind CSS for styling
4. Keep it simple and reusable
5. Add TypeScript types for all props
6. Make it accessible

---

## Questions?

- Check `/AGENTS.md` for project-level rules
- These are basic UI primitives only - complex components belong in ui/extension or web/
