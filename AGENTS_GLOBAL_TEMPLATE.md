# Global AGENTS.md Template

> **Note**: This is a template for `~/.codex/AGENTS.md` (global preferences).
---

## Developer Preferences

### Technology Stack

- **TypeScript** preferred over JavaScript for new code
- **React/Preact** for UI components
- **Tailwind CSS** for styling (or CSS Modules if preferred)
- **TanStack Query** (React Query) for server state management
- **Vite** for build tooling (fast, simple)

### Code Style

#### Naming Conventions

- **Components**: PascalCase (`LockInSidebar.tsx`)
- **Hooks**: camelCase starting with `use` (`useChat.ts`)
- **Types/Interfaces**: PascalCase (`Note`, `CourseContext`)
- **Functions**: camelCase (`createNote`, `extractCourseCode`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`)
- **Files**: camelCase for utilities, PascalCase for components

#### Function Design

- **Small and focused**: One responsibility per function
- **Pure when possible**: Avoid side effects, return values instead
- **Clear names**: Function name should describe what it does
- **Type everything**: Use TypeScript types, avoid `any`

#### Code Organization

- **Separation of concerns**: UI, business logic, and data access should be separate
- **Single responsibility**: Each file/function should do one thing well
- **DRY**: Don't repeat yourself, but don't over-abstract either
- **Clear boundaries**: Know what each layer should and shouldn't do

---

## AI Agent Behavior

### Before Making Changes

1. **Understand the context**: Read relevant files, understand the architecture
2. **Check AGENTS.md files**: Look for project-specific or folder-specific rules
3. **Describe your plan**: Explain what you'll change and why
4. **Ask if unclear**: Don't guess - ask for clarification

### Making Changes

1. **Incremental**: Make small, focused changes
2. **Testable**: Write code that's easy to test
3. **Documented**: Add comments for complex logic
4. **Consistent**: Follow existing patterns in the codebase

### Code Review Checklist

- [ ] Does this follow the project's architecture?
- [ ] Are types defined and used correctly?
- [ ] Is the code testable?
- [ ] Are functions small and focused?
- [ ] Is error handling appropriate?
- [ ] Are there any Chrome/extension dependencies leaking into shared code?

---

## General Principles

### Readability Over Cleverness

- **Prefer clear code** over clever one-liners
- **Use descriptive variable names** (`courseCode` not `cc`)
- **Add comments** for complex logic or non-obvious decisions
- **Break up long functions** into smaller, named functions

### Defensive Programming

- **Validate inputs**: Check for null/undefined, validate types
- **Handle errors gracefully**: Don't silently swallow errors
- **Provide helpful error messages**: Tell users what went wrong and how to fix it
- **Use TypeScript**: Catch errors at compile time

### Performance

- **Measure before optimizing**: Don't optimize prematurely
- **Use appropriate data structures**: Arrays for lists, Maps for lookups
- **Lazy load when possible**: Don't load everything upfront
- **Cache expensive operations**: But invalidate cache appropriately

### Testing

- **Test business logic**: Unit tests for domain logic
- **Test integrations**: Integration tests for adapters, API clients
- **Test user flows**: E2E tests for critical paths
- **Keep tests simple**: Tests should be easy to read and maintain

---

## Comment Style

### File-Level Comments

```typescript
/**
 * Note Domain Model and Utilities
 * 
 * Pure domain logic for notes - no Chrome dependencies.
 * 
 * Responsibilities:
 * - Note creation and normalization
 * - Note content sanitization
 * - Note filtering and matching
 * 
 * Should NOT:
 * - Access Chrome APIs
 * - Make API calls directly
 * - Render UI
 */
```

### Function Comments (JSDoc/TSDoc)

```typescript
/**
 * Create an empty note with default values
 * 
 * @param prefill - Optional partial note data to prefill
 * @returns A new note object with defaults
 */
export function createEmptyNote(prefill: Partial<Note> = {}): Note {
  // ...
}
```

### Inline Comments

- **Explain WHY**, not WHAT (code should be self-documenting)
- **Use for complex logic** or non-obvious decisions
- **Keep comments up to date** - delete outdated comments

---

## Error Handling

### Principles

- **Fail fast**: Catch errors early, don't let them propagate silently
- **Provide context**: Include relevant information in error messages
- **Log appropriately**: Log errors for debugging, but don't expose internals to users
- **Handle gracefully**: Show user-friendly messages, don't crash

### Pattern

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Log for debugging
  console.error('Operation failed:', error);
  
  // Return user-friendly error
  throw new Error('Failed to perform operation. Please try again.');
}
```

---

## Git Practices

### Commit Messages

- **Clear and descriptive**: "Add Moodle adapter" not "fix stuff"
- **Present tense**: "Add feature" not "Added feature"
- **Reference issues**: "Fix #123: Course code extraction"

### Branch Strategy

- **Feature branches**: One feature per branch
- **Small PRs**: Keep pull requests focused and reviewable
- **Test before PR**: Ensure code works before requesting review

---

## Questions?

When in doubt:

1. **Check existing code**: Look for similar patterns
2. **Check AGENTS.md**: Project or folder-specific rules
3. **Ask**: Don't guess - ask for clarification
4. **Be consistent**: Follow existing patterns even if you'd do it differently

**Remember**: Code is read more than it's written. Write for your future self (and others).
