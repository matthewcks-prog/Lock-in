# Integrations AGENTS.md

> **Inherits from**: [/AGENTS.md](../AGENTS.md)  
> **Last Updated**: 2026-01-28  
> **Purpose**: Site adapter pattern, adding new sites, boundaries with extension/core

## Table of Contents

- [Purpose](#purpose)
- [Non-Goals](#non-goals)
- [Architectural Boundaries](#architectural-boundaries)
- [Allowed & Forbidden Imports](#allowed--forbidden-imports)
- [Required Patterns](#required-patterns)
- [Testing Rules](#testing-rules)
- [Golden Path - Adding a New Site](#golden-path---adding-a-new-site)
- [Common Failure Modes](#common-failure-modes)
- [PR Checklist](#pr-checklist)

---

## Purpose

The `/integrations` directory contains **site-specific adapters** that extract course context from learning platforms:

1. **Moodle** - Course code, week, page type detection
2. **Edstem** - Course identifier, lesson detection
3. **Panopto** - Video metadata (handled by transcript providers)
4. **Future sites** - Add new adapters here

**This directory SHOULD contain**:

- Site adapters implementing `BaseAdapter` interface
- DOM parsing logic (pure, no side effects)
- URL pattern matching
- Adapter registry and selection logic

**This directory MUST NOT contain**:

- Backend API calls (extension layer calls API, not adapters)
- Chrome extension APIs (pass as parameters if needed)
- UI rendering logic
- Business logic (that's `/core`)
- Transcript extraction (that's `/core/transcripts/providers`)

---

## Non-Goals

**What this layer is NOT**:

- NOT a backend client (adapters don't call the API)
- NOT a transcript provider (use `/core/transcripts/providers`)
- NOT Chrome extension code (use `/extension`)
- NOT business logic (use `/core`)

---

## Architectural Boundaries

### Adapter Pattern

```
┌──────────────────────────────────────────────────┐
│  CONTENT SCRIPT (/extension)                     │
│  - Detects page URL                              │
│  - Selects adapter from registry                 │
│  - Passes DOM + URL to adapter                   │
│  - Uses extracted context for sidebar            │
└────────────────┬─────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────┐
│  INTEGRATIONS (Site Adapters)                    │
│  ┌────────────────────────────────────────────┐ │
│  │ BaseAdapter Interface                      │ │
│  │ - canHandle(url): boolean                  │ │
│  │ - getCourseCode(dom): string | null        │ │
│  │ - getWeek(dom): number | null              │ │
│  │ - getPageContext(dom, url): PageContext    │ │
│  └────────────────────────────────────────────┘ │
│  ┌─────────────┬──────────────┬──────────────┐ │
│  │ Moodle      │ Edstem       │ Panopto      │ │
│  │ Adapter     │ Adapter      │ (future)     │ │
│  └─────────────┴──────────────┴──────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ Registry (index.ts)                        │ │
│  │ - Adapter selection by URL                 │ │
│  │ - Fallback inference if no match           │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                 ↓ (returns PageContext)
┌──────────────────────────────────────────────────┐
│  EXTENSION SIDEBAR (/ui/extension)               │
│  - Receives PageContext (courseCode, week, etc.) │
│  - Uses context for AI prompts, note tagging     │
└──────────────────────────────────────────────────┘
```

### Data Flow

1. **Content script** gets current page URL + DOM
2. **Registry** selects adapter based on `canHandle(url)`
3. **Adapter** parses DOM and returns `PageContext`
4. **Content script** passes context to React sidebar
5. **Sidebar** uses context for AI requests, note organization

**NO direct backend calls from adapters** - Extension layer handles API communication

---

## Allowed & Forbidden Imports

### Allowed Imports

**MUST import only**:

- Core domain types (`/core/domain/types.ts`)
- Other `/integrations` modules (shared helpers)
- NO external dependencies (pure DOM parsing)

**MAY use**:

- Standard DOM APIs (`Document`, `Element`, `querySelector`)
- URL parsing (Web standard `URL` class)
- Regular expressions

### Forbidden Imports

**MUST NOT import**:

- ❌ Backend imports (`/backend/*`)
- ❌ API client (`/api/*`) - Adapters don't call the API
- ❌ Express types
- ❌ Chrome extension APIs (unless passed as parameters)
- ❌ UI components (`/ui/*`)
- ❌ External HTTP libraries (adapters don't make network calls)

### Examples

```typescript
// ✅ GOOD - Pure DOM parsing
import { BaseAdapter, PageContext } from './baseAdapter';

export class MoodleAdapter implements BaseAdapter {
  canHandle(url: string): boolean {
    return url.includes('learning.monash.edu');
  }

  getCourseCode(dom: Document): string | null {
    const heading = dom.querySelector('.page-header-headings h1');
    return heading?.textContent?.match(/[A-Z]{3}\d{4}/)?.[0] ?? null;
  }
}

// ❌ BAD - Backend call
import { apiClient } from '../../api/client'; // NO!

export class MoodleAdapter implements BaseAdapter {
  async getCourseCode(dom: Document): Promise<string | null> {
    const code = dom.querySelector('h1')?.textContent;
    await apiClient.saveCourseCode(code); // NO! Adapters don't call API
    return code;
  }
}

// ❌ BAD - Chrome API
export class MoodleAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string | null {
    chrome.storage.local.set({ lastCourse: code }); // NO! Extension-specific
    return code;
  }
}
```

---

## Required Patterns

### 1. Implement BaseAdapter Interface

**MUST implement all interface methods**:

```typescript
// integrations/adapters/baseAdapter.ts
export interface BaseAdapter {
  canHandle(url: string): boolean;
  getCourseCode(dom: Document): string | null;
  getWeek(dom: Document): number | null;
  getPageContext(dom: Document, url: string): PageContext;
}

export interface PageContext {
  courseContext: {
    courseCode: string | null;
    week: number | null;
  };
  pageType: 'assignment' | 'lesson' | 'video' | 'discussion' | 'other';
  pageTitle: string | null;
}
```

**Example implementation**:

```typescript
// integrations/adapters/moodleAdapter.ts
import { BaseAdapter, PageContext } from './baseAdapter';

export class MoodleAdapter implements BaseAdapter {
  canHandle(url: string): boolean {
    return url.includes('learning.monash.edu') || url.includes('moodle.org');
  }

  getCourseCode(dom: Document): string | null {
    // Try page header first
    const header = dom.querySelector('.page-header-headings h1');
    const match = header?.textContent?.match(/[A-Z]{3}\d{4}/);
    if (match) return match[0];

    // Fallback: breadcrumb
    const breadcrumb = dom.querySelector('.breadcrumb');
    const bcMatch = breadcrumb?.textContent?.match(/[A-Z]{3}\d{4}/);
    return bcMatch?.[0] ?? null;
  }

  getWeek(dom: Document): number | null {
    const weekSection = dom.querySelector('.current[id^="section-"]');
    if (!weekSection) return null;

    const weekMatch = weekSection.id.match(/section-(\d+)/);
    return weekMatch ? parseInt(weekMatch[1], 10) : null;
  }

  getPageContext(dom: Document, url: string): PageContext {
    const courseCode = this.getCourseCode(dom);
    const week = this.getWeek(dom);
    const pageType = this.detectPageType(url, dom);
    const pageTitle = dom.querySelector('h1')?.textContent?.trim() ?? null;

    return {
      courseContext: { courseCode, week },
      pageType,
      pageTitle,
    };
  }

  private detectPageType(url: string, dom: Document): PageContext['pageType'] {
    if (url.includes('/mod/assign/')) return 'assignment';
    if (url.includes('/mod/page/')) return 'lesson';
    if (url.includes('/mod/forum/')) return 'discussion';
    if (url.includes('/mod/panopto/')) return 'video';
    return 'other';
  }
}
```

### 2. Pure DOM Parsing (No Side Effects)

**MUST be pure** (no network calls, no storage writes):

```typescript
// ✅ GOOD - Pure parsing
export class EdstemAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string | null {
    const courseLink = dom.querySelector('a[href*="/course/"]');
    const match = courseLink?.href.match(/course\/(\d+)/);
    return match ? `EDSTEM-${match[1]}` : null;
  }
}

// ❌ BAD - Side effects
export class EdstemAdapter implements BaseAdapter {
  async getCourseCode(dom: Document): Promise<string | null> {
    const code = dom.querySelector('h1')?.textContent;

    // NO! Network call
    await fetch('/api/log-course', { method: 'POST', body: code });

    // NO! Storage write
    localStorage.setItem('lastCourse', code);

    return code;
  }
}
```

### 3. Register Adapter in Index

**MUST register new adapters**:

```typescript
// integrations/index.ts
import { MoodleAdapter } from './adapters/moodleAdapter';
import { EdstemAdapter } from './adapters/edstemAdapter';
import { NewSiteAdapter } from './adapters/newSiteAdapter'; // New adapter

export const adapters = [
  new MoodleAdapter(),
  new EdstemAdapter(),
  new NewSiteAdapter(), // Register here
];

export function selectAdapter(url: string): BaseAdapter | null {
  return adapters.find((adapter) => adapter.canHandle(url)) ?? null;
}
```

### 4. Fallback Inference

**SHOULD provide fallback** if no adapter matches:

```typescript
// integrations/index.ts
export function getPageContextWithFallback(url: string, dom: Document): PageContext {
  const adapter = selectAdapter(url);

  if (adapter) {
    return adapter.getPageContext(dom, url);
  }

  // Fallback: infer from URL/DOM
  return {
    courseContext: {
      courseCode: inferCourseCodeFromUrl(url),
      week: null,
    },
    pageType: 'other',
    pageTitle: dom.querySelector('h1')?.textContent?.trim() ?? null,
  };
}
```

---

## Testing Rules

### Unit Test Adapters

**MUST test with DOM fixtures**:

```typescript
// integrations/adapters/__tests__/moodleAdapter.test.ts
import { test } from 'node:test';
import { assert } from 'node:assert';
import { JSDOM } from 'jsdom';
import { MoodleAdapter } from '../moodleAdapter';

test('MoodleAdapter extracts course code from header', () => {
  const html = `
    <div class="page-header-headings">
      <h1>FIT3171 Databases - Week 5</h1>
    </div>
  `;
  const dom = new JSDOM(html).window.document;
  const adapter = new MoodleAdapter();

  const courseCode = adapter.getCourseCode(dom);

  assert.equal(courseCode, 'FIT3171');
});

test('MoodleAdapter detects assignment page type', () => {
  const url = 'https://learning.monash.edu/mod/assign/view.php?id=123';
  const dom = new JSDOM('<h1>Assignment 1</h1>').window.document;
  const adapter = new MoodleAdapter();

  const context = adapter.getPageContext(dom, url);

  assert.equal(context.pageType, 'assignment');
});
```

### Test with Multiple Fixtures

**SHOULD test edge cases**:

```typescript
test('MoodleAdapter returns null when course code not found', () => {
  const html = '<h1>No course code here</h1>';
  const dom = new JSDOM(html).window.document;
  const adapter = new MoodleAdapter();

  const courseCode = adapter.getCourseCode(dom);

  assert.equal(courseCode, null);
});

test('MoodleAdapter handles malformed HTML gracefully', () => {
  const html = '<div><h1>'; // Malformed
  const dom = new JSDOM(html).window.document;
  const adapter = new MoodleAdapter();

  // Should not throw
  const courseCode = adapter.getCourseCode(dom);
  assert.equal(courseCode, null);
});
```

---

## Golden Path - Adding a New Site

### Step-by-Step Workflow

**1. Create adapter file** (`integrations/adapters/newSiteAdapter.ts`):

```typescript
import { BaseAdapter, PageContext } from './baseAdapter';

export class NewSiteAdapter implements BaseAdapter {
  canHandle(url: string): boolean {
    return url.includes('newsite.edu') || url.includes('new-lms.com');
  }

  getCourseCode(dom: Document): string | null {
    // Inspect site's HTML structure
    const courseElement = dom.querySelector('[data-course-code]');
    return courseElement?.getAttribute('data-course-code') ?? null;
  }

  getWeek(dom: Document): number | null {
    // Parse week from breadcrumb, sidebar, or URL
    const weekLabel = dom.querySelector('.week-indicator');
    const match = weekLabel?.textContent?.match(/Week (\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  getPageContext(dom: Document, url: string): PageContext {
    return {
      courseContext: {
        courseCode: this.getCourseCode(dom),
        week: this.getWeek(dom),
      },
      pageType: this.detectPageType(url, dom),
      pageTitle: dom.title,
    };
  }

  private detectPageType(url: string, dom: Document): PageContext['pageType'] {
    if (url.includes('/assignment')) return 'assignment';
    if (url.includes('/lecture')) return 'lesson';
    if (url.includes('/quiz')) return 'assignment';
    if (url.includes('/video')) return 'video';
    return 'other';
  }
}
```

**2. Register adapter** (`integrations/index.ts`):

```typescript
import { NewSiteAdapter } from './adapters/newSiteAdapter';

export const adapters = [
  new MoodleAdapter(),
  new EdstemAdapter(),
  new NewSiteAdapter(), // Add here
];
```

**3. Write tests** (`integrations/adapters/__tests__/newSiteAdapter.test.ts`):

```typescript
import { test } from 'node:test';
import { assert } from 'node:assert';
import { JSDOM } from 'jsdom';
import { NewSiteAdapter } from '../newSiteAdapter';

test('NewSiteAdapter canHandle recognizes site URLs', () => {
  const adapter = new NewSiteAdapter();

  assert.equal(adapter.canHandle('https://newsite.edu/course/123'), true);
  assert.equal(adapter.canHandle('https://moodle.org'), false);
});

test('NewSiteAdapter extracts course code', () => {
  const html = '<div data-course-code="CS101">Course Title</div>';
  const dom = new JSDOM(html).window.document;
  const adapter = new NewSiteAdapter();

  const code = adapter.getCourseCode(dom);
  assert.equal(code, 'CS101');
});
```

**4. Test on live site**:

1. Load extension
2. Navigate to new site
3. Open sidebar
4. Verify course code appears in extension state
5. Verify notes tagged with correct course

**5. Document** (`docs/reference/CODE_OVERVIEW.md`):

```markdown
## Supported Sites

- **Moodle** (`MoodleAdapter`) - learning.monash.edu
- **Edstem** (`EdstemAdapter`) - edstem.org
- **NewSite** (`NewSiteAdapter`) - newsite.edu, new-lms.com
```

---

## Common Failure Modes

### 1. Adapter Making Backend Calls

**Symptom**: Adapters import `/api/*` or `fetch`

```typescript
// ❌ BAD
import { apiClient } from '../../api/client';

export class MoodleAdapter implements BaseAdapter {
  async getCourseCode(dom: Document): Promise<string> {
    const code = dom.querySelector('h1')?.textContent;
    await apiClient.logCourseView(code); // NO!
    return code;
  }
}

// ✅ GOOD
export class MoodleAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string | null {
    return dom.querySelector('h1')?.textContent?.match(/[A-Z]{3}\d{4}/)?.[0] ?? null;
  }
}
```

**Fix**: Remove API calls. Extension layer logs course views, not adapters.

### 2. Browser-Specific Side Effects

**Symptom**: Adapters write to `localStorage`, cookies, or make network calls

```typescript
// ❌ BAD
export class EdstemAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string | null {
    const code = dom.querySelector('[data-course]')?.textContent;
    localStorage.setItem('lastCourse', code); // NO!
    return code;
  }
}

// ✅ GOOD
export class EdstemAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string | null {
    return dom.querySelector('[data-course]')?.textContent?.trim() ?? null;
  }
}
```

**Fix**: Keep adapters pure. Extension layer handles storage.

### 3. Missing Null Checks

**Symptom**: Adapters throw errors when DOM structure changes

```typescript
// ❌ BAD - Throws if element missing
export class MoodleAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string {
    return dom.querySelector('h1').textContent.match(/[A-Z]{3}\d{4}/)[0]; // Throws!
  }
}

// ✅ GOOD - Graceful fallback
export class MoodleAdapter implements BaseAdapter {
  getCourseCode(dom: Document): string | null {
    const heading = dom.querySelector('h1');
    if (!heading || !heading.textContent) return null;

    const match = heading.textContent.match(/[A-Z]{3}\d{4}/);
    return match?.[0] ?? null;
  }
}
```

**Fix**: Use optional chaining, nullish coalescing, return `null` on failure

### 4. Adapter Not Registered

**Symptom**: New adapter exists but isn't used

```typescript
// ❌ BAD - Forgot to register
// File: integrations/adapters/panoptoAdapter.ts
export class PanoptoAdapter implements BaseAdapter { ... }

// File: integrations/index.ts
export const adapters = [
  new MoodleAdapter(),
  new EdstemAdapter()
  // PanoptoAdapter missing!
];

// ✅ GOOD
import { PanoptoAdapter } from './adapters/panoptoAdapter';

export const adapters = [
  new MoodleAdapter(),
  new EdstemAdapter(),
  new PanoptoAdapter() // Registered
];
```

**Fix**: Add adapter to registry in `integrations/index.ts`

---

## PR Checklist

Before merging `/integrations` changes, verify:

### Adapter Implementation

- [ ] Implements all `BaseAdapter` methods (`canHandle`, `getCourseCode`, `getWeek`, `getPageContext`)
- [ ] Returns `null` gracefully when data not found (no throws)
- [ ] Uses optional chaining and nullish coalescing for safety
- [ ] Pure functions (no side effects, no network calls, no storage writes)

### Integration

- [ ] Registered in `integrations/index.ts`
- [ ] Tested on live site (manually load extension)
- [ ] Course code appears correctly in extension state

### Testing

- [ ] Unit tests with DOM fixtures (jsdom or similar)
- [ ] Tests cover: happy path, missing elements, malformed HTML
- [ ] Test coverage >80%

### No Boundary Violations

- [ ] Does NOT import `/api/*` (adapters don't call backend)
- [ ] Does NOT import `/backend/*`
- [ ] Does NOT import Chrome APIs (unless passed as parameters)
- [ ] Does NOT import `/ui/*` (adapters don't render UI)

### Documentation

- [ ] Added site to supported sites list in `docs/reference/CODE_OVERVIEW.md`
- [ ] JSDoc comments for public methods
- [ ] Updated `/integrations/README.md` if exists

---

## Questions?

1. Check [/AGENTS.md](../AGENTS.md) for project-wide principles
2. Review existing adapters (`MoodleAdapter`, `EdstemAdapter`) for patterns
3. Test on live site before merging

**Remember**: Adapters parse DOM, return context. No backend calls. No Chrome APIs. Pure functions. Register in index.ts.
