# Shared UI Components AGENTS.md

> **Inherits from**: [/AGENTS.md](../../AGENTS.md)  
> **Last Updated**: 2026-01-28  
> **Purpose**: Low-level UI primitives only (Button, Card, Input, Tabs)

## Table of Contents

- [Purpose](#purpose)
- [Non-Goals](#non-goals)
- [Architectural Boundaries](#architectural-boundaries)
- [Allowed & Forbidden Imports](#allowed--forbidden-imports)
- [Required Patterns](#required-patterns)
- [Testing Rules](#testing-rules)
- [Accessibility Requirements](#accessibility-requirements)
- [Golden Path - Adding a Component](#golden-path---adding-a-component)
- [Common Failure Modes](#common-failure-modes)
- [PR Checklist](#pr-checklist)

---

## Purpose

The `/shared/ui` directory contains **basic, reusable UI components** (primitives) used by both:

- Chrome extension sidebar (`/ui/extension`)
- Future web app (`/web`)

**This directory SHOULD contain**:

- Low-level primitives: `Button`, `Card`, `TextInput`, `Tabs`, `Badge`, `Spinner`
- Styled with Tailwind CSS
- Accessible by default (ARIA labels, keyboard navigation)
- Framework-agnostic React components (no Chrome/Next.js specifics)

**This directory MUST NOT contain**:

- Business logic (use `/core/services`)
- API calls (use `/api` from consuming code)
- Chrome-specific code (use `/extension`)
- Next.js-specific code (use `/web` when created)
- High-level components (those belong in `/ui/extension` or `/web`)

---

## Non-Goals

**What this layer is NOT**:

- NOT for complex, feature-specific components (e.g., `NotesPanel`, `ChatSection`)
- NOT for business logic or data fetching
- NOT for platform-specific code (Chrome, Next.js)
- NOT for layouts or pages (use `/ui/extension` or `/web`)

---

## Architectural Boundaries

### Component Hierarchy

```
HIGH-LEVEL (Specific to Extension/Web App)
┌────────────────────────────────────────────┐
│  /ui/extension  or  /web                   │
│  - NotesPanel, ChatSection, Sidebar        │
│  - Feature-specific, complex components    │
└────────────────┬───────────────────────────┘
                 ↓ (uses)
LOW-LEVEL (Shared Primitives)
┌────────────────────────────────────────────┐
│  /shared/ui                                │
│  - Button, Card, TextInput, Tabs, Badge    │
│  - Generic, reusable, accessible           │
│  - NO business logic, NO API calls         │
└────────────────────────────────────────────┘
```

### Current Components

| Component   | Purpose                           | Props                                      |
| ----------- | --------------------------------- | ------------------------------------------ |
| `Button`    | Clickable button with variants    | `variant`, `size`, `loading`, `disabled`   |
| `Card`      | Container with consistent styling | `active`, `clickable`, `children`          |
| `TextInput` | Text input with label/error       | `label`, `error`, `helperText`, `value`    |
| `Tabs`      | Tabbed interface                  | `tabs`, `activeTab`, `onChange`, `variant` |

---

## Allowed & Forbidden Imports

### Allowed Imports

**MUST import only**:

- `react` (React, hooks)
- TypeScript types
- Tailwind CSS classes (via `className`)
- Other `/shared/ui` components (composition)

### Forbidden Imports

**MUST NOT import**:

- ❌ `/core/services` - NO business logic in UI primitives
- ❌ `/api/*` - NO API calls in UI primitives
- ❌ `chrome.*` - NO Chrome APIs
- ❌ `next/*` - NO Next.js-specific code
- ❌ External state management libraries (Redux, Zustand) - Components should be stateless or use local state only
- ❌ Complex dependencies (moment.js, lodash) - Keep primitives lightweight

### Examples

```tsx
// ✅ GOOD - Simple, focused component
import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
}: ButtonProps) {
  const baseClasses = 'font-medium rounded transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'bg-transparent hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

// ❌ BAD - Business logic in UI primitive
import { noteService } from '@core/services/noteService'; // NO!
import { apiClient } from '@api/client'; // NO!

export function Button({ onClick, noteId }: { onClick?: () => void; noteId?: string }) {
  const handleClick = async () => {
    // NO business logic!
    const note = await apiClient.getNote(noteId);
    await noteService.update(note);
    onClick?.();
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

---

## Required Patterns

### 1. Composition Over Configuration

**SHOULD compose simple components** into complex ones:

```tsx
// ✅ GOOD - Composable primitives
<Card>
  <h2>Title</h2>
  <TextInput label="Name" value={name} onChange={setName} />
  <Button variant="primary" onClick={handleSubmit}>Submit</Button>
</Card>

// ❌ BAD - Overly configured component
<FormCard
  title="Title"
  fields={[{ label: 'Name', value: name, onChange: setName }]}
  submitLabel="Submit"
  onSubmit={handleSubmit}
/> // Too high-level for /shared/ui
```

### 2. Controlled Components

**SHOULD use controlled pattern** for inputs:

```tsx
// ✅ GOOD - Controlled component
interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
}

export function TextInput({ label, value, onChange, error, helperText }: TextInputProps) {
  return (
    <div>
      <label htmlFor={`input-${label}`}>{label}</label>
      <input
        id={`input-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${label}` : helperText ? `helper-${label}` : undefined}
      />
      {error && (
        <span id={`error-${label}`} role="alert">
          {error}
        </span>
      )}
      {helperText && <span id={`helper-${label}`}>{helperText}</span>}
    </div>
  );
}
```

### 3. Minimal State

**SHOULD be stateless or use minimal local state**:

```tsx
// ✅ GOOD - Stateless
export function Card({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return <div className={`card ${active ? 'active' : ''}`}>{children}</div>;
}

// ✅ ACCEPTABLE - Minimal local state for UI only
export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const [focusedIdx, setFocusedIdx] = React.useState(0); // UI state only

  // Keyboard navigation logic...
  return <div role="tablist">...</div>;
}

// ❌ BAD - Complex state management
export function Button({ onClick }: { onClick?: () => void }) {
  const [clickCount, setClickCount] = React.useState(0);
  const [lastClickTime, setLastClickTime] = React.useState(0);
  const [isRateLimited, setIsRateLimited] = React.useState(false);

  // Too much logic for a primitive component
}
```

### 4. TypeScript Props

**MUST export TypeScript interfaces**:

```tsx
// ✅ GOOD - Exported interface
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button(props: ButtonProps) { ... }
```

---

## Testing Rules

### Component Tests

**MUST test components with React Testing Library**:

```tsx
// components/__tests__/Button.test.tsx
import { test } from 'node:test';
import { assert } from 'node:assert';
import { render, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

test('Button renders children', () => {
  const { getByText } = render(<Button>Click me</Button>);
  assert.ok(getByText('Click me'));
});

test('Button calls onClick when clicked', () => {
  let clicked = false;
  const { getByText } = render(
    <Button
      onClick={() => {
        clicked = true;
      }}
    >
      Click
    </Button>,
  );

  fireEvent.click(getByText('Click'));

  assert.equal(clicked, true);
});

test('Button is disabled when loading', () => {
  const { getByText } = render(<Button loading>Click</Button>);
  const button = getByText('Loading...').closest('button');

  assert.equal(button?.disabled, true);
});
```

### Accessibility Tests

**SHOULD test accessibility**:

```tsx
test('TextInput has accessible label', () => {
  const { getByLabelText } = render(<TextInput label="Name" value="" onChange={() => {}} />);

  const input = getByLabelText('Name');
  assert.ok(input);
});

test('TextInput shows error with aria-invalid', () => {
  const { getByLabelText, getByRole } = render(
    <TextInput label="Email" value="" onChange={() => {}} error="Invalid email" />,
  );

  const input = getByLabelText('Email');
  const alert = getByRole('alert');

  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.ok(alert.textContent?.includes('Invalid email'));
});
```

---

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance

**MUST implement**:

1. **Keyboard Navigation**
   - Buttons: `Enter` and `Space` activate
   - Tabs: Arrow keys navigate, `Home`/`End` jump to first/last
   - Inputs: Focusable with `Tab`

2. **ARIA Labels**
   - Inputs: `htmlFor` binds label to input
   - Error states: `aria-invalid`, `aria-describedby` error message
   - Loading states: `aria-busy`
   - Tabs: `role="tablist"`, `role="tab"`, `aria-selected`

3. **Focus Management**
   - Visible focus indicators (outline, ring)
   - Logical tab order
   - Focus trap for modals (if added)

4. **Color Contrast**
   - Text/background contrast ≥4.5:1 (normal text)
   - Text/background contrast ≥3:1 (large text)

5. **Screen Reader Support**
   - Semantic HTML (`<button>`, `<input>`, `<label>`)
   - Error announcements (`role="alert"`)
   - Helper text associations (`aria-describedby`)

### Examples

```tsx
// ✅ GOOD - Accessible input
<div>
  <label htmlFor="email-input">Email</label>
  <input
    id="email-input"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    aria-invalid={!!emailError}
    aria-describedby={emailError ? 'email-error' : 'email-helper'}
  />
  {emailError && <span id="email-error" role="alert">{emailError}</span>}
  {!emailError && <span id="email-helper">We'll never share your email</span>}
</div>

// ✅ GOOD - Accessible tabs
<div role="tablist">
  {tabs.map((tab, idx) => (
    <button
      key={tab.id}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls={`panel-${tab.id}`}
      onClick={() => onChange(tab.id)}
      onKeyDown={(e) => handleKeyDown(e, idx)}
    >
      {tab.label}
    </button>
  ))}
</div>
```

---

## Golden Path - Adding a Component

### Step-by-Step

1. **Create component file** (`components/NewComponent.tsx`):

```tsx
import React from 'react';

export interface NewComponentProps {
  // Define props
}

export function NewComponent({ ... }: NewComponentProps) {
  return (
    <div>
      {/* Implementation */}
    </div>
  );
}
```

2. **Export from index** (`components/index.ts`):

```typescript
export { Button, type ButtonProps } from './Button';
export { Card, type CardProps } from './Card';
export { NewComponent, type NewComponentProps } from './NewComponent'; // Add here
```

3. **Write tests** (`components/__tests__/NewComponent.test.tsx`):

```tsx
import { test } from 'node:test';
import { assert } from 'node:assert';
import { render } from '@testing-library/react';
import { NewComponent } from '../NewComponent';

test('NewComponent renders correctly', () => {
  const { container } = render(<NewComponent />);
  assert.ok(container.firstChild);
});

test('NewComponent is keyboard accessible', () => {
  // Test keyboard navigation
});

test('NewComponent has correct ARIA attributes', () => {
  // Test accessibility
});
```

4. **Document** (add to this file or README):

````markdown
### `NewComponent`

**Purpose**: Brief description

**Props**:

- `prop1` (string) - Description
- `prop2` (boolean, optional) - Description

**Example**:

```tsx
<NewComponent prop1="value" />
```
````

````

---

## Common Failure Modes

### 1. Business Logic in Primitives

**Symptom**: Components import `/core/services` or `/api`

```tsx
// ❌ BAD
import { noteService } from '@core/services/noteService';

export function Button({ noteId }: { noteId: string }) {
  const handleClick = async () => {
    await noteService.delete(noteId); // NO!
  };

  return <button onClick={handleClick}>Delete</button>;
}

// ✅ GOOD - Pass handler from parent
export function Button({ onClick }: { onClick?: () => void }) {
  return <button onClick={onClick}>Delete</button>;
}

// Parent (in /ui/extension):
<Button onClick={() => noteService.delete(noteId)} />
````

**Fix**: Components receive callbacks, business logic stays in consuming code

### 2. Platform-Specific Code

**Symptom**: Components use `chrome.*` or `next/*`

```tsx
// ❌ BAD
export function Button({ onClick }: { onClick?: () => void }) {
  const handleClick = () => {
    chrome.storage.local.set({ clicked: true }); // NO!
    onClick?.();
  };

  return <button onClick={handleClick}>Click</button>;
}

// ✅ GOOD
export function Button({ onClick }: { onClick?: () => void }) {
  return <button onClick={onClick}>Click</button>;
}
```

**Fix**: Remove platform code, keep primitive generic

### 3. Missing Accessibility

**Symptom**: Components fail keyboard navigation or screen readers

```tsx
// ❌ BAD - Not keyboard accessible
<div onClick={handleClick}>Click me</div> // Not focusable!

// ✅ GOOD - Accessible button
<button onClick={handleClick}>Click me</button>

// ❌ BAD - Missing label
<input value={value} onChange={onChange} />

// ✅ GOOD - Accessible input
<label htmlFor="input-id">Label</label>
<input id="input-id" value={value} onChange={onChange} />
```

**Fix**: Use semantic HTML, add ARIA attributes, test with keyboard

### 4. Overly Complex Components

**Symptom**: Component has too many responsibilities

```tsx
// ❌ BAD - Too complex for /shared/ui
export function SmartForm({
  fields,
  onSubmit,
  validation,
  apiEndpoint,
  successMessage,
}: SmartFormProps) {
  // 200 lines of form logic, validation, API calls
}

// ✅ GOOD - Simple primitive
export function TextInput({ label, value, onChange, error }: TextInputProps) {
  // 30 lines of input rendering
}
```

**Fix**: Move complex components to `/ui/extension` or `/web`. Keep primitives simple.

### 5. Component Size Exceeds Limit

**Symptom**: Component file >150 lines

**Fix**: Extract sub-components, move logic to hooks, simplify

---

## PR Checklist

Before merging `/shared/ui` changes, verify:

### Component Quality

- [ ] Component <150 lines
- [ ] Single responsibility (Button does ONE thing)
- [ ] Reusable across extension and web app
- [ ] Styled with Tailwind CSS
- [ ] TypeScript props exported

### No Business Logic

- [ ] No imports from `/core/services`
- [ ] No imports from `/api`
- [ ] No API calls or data fetching
- [ ] Receives callbacks from parent (not implements logic)

### Platform-Agnostic

- [ ] No Chrome APIs (`chrome.*`)
- [ ] No Next.js APIs (`next/*`)
- [ ] Works in both extension and web contexts

### Accessibility

- [ ] Keyboard navigable (Tab, Enter, Space, Arrows)
- [ ] ARIA attributes (labels, roles, states)
- [ ] Semantic HTML (`<button>`, `<label>`, `<input>`)
- [ ] Color contrast ≥4.5:1
- [ ] Tested with keyboard-only navigation

### Testing

- [ ] Component tests with React Testing Library
- [ ] Accessibility tests (keyboard, ARIA)
- [ ] Test coverage >80%

### Documentation

- [ ] Props documented in code comments or README
- [ ] Example usage provided
- [ ] Exported from `components/index.ts`

---

## Questions?

1. Check [/AGENTS.md](../../AGENTS.md) for project-wide principles
2. Review existing components (`Button`, `Card`, `TextInput`) for patterns
3. Keep it simple - complex components belong in `/ui/extension` or `/web`

**Remember**: These are basic UI primitives. No business logic. No API calls. Accessible by default. Platform-agnostic. Simple and focused.
