# Tasks Feature Architecture

> **Version**: 1.0 | **Updated**: 2026-01-01

## Overview

The Tasks feature provides a lightweight, study-focused to-do system integrated into the Lock-in sidebar. Inspired by iPhone Notes checklists, it emphasizes speed, simplicity, and inline editing for capturing and managing study tasks.

## Core Concepts

### Study-Focused Design

Unlike generic to-do apps, Tasks is purpose-built for study workflows:

- **Course association**: Tasks can be tagged with course codes (e.g., `FIT1045`)
- **Source linking**: Tasks can reference their origin URL (lecture, assignment page)
- **Quick capture**: Minimal friction from thought to task
- **Inline editing**: Edit task titles directly without modal dialogs

### User Journey

```
Open Sidebar → Tasks Tab → Quick Add → Edit Inline → Check Complete
```

## Architecture

### Layer Responsibilities

| Layer    | Component         | Responsibility                |
| -------- | ----------------- | ----------------------------- |
| Database | `tasks` table     | Persistent storage with RLS   |
| Backend  | `tasksRepository` | CRUD operations               |
| Backend  | `tasksService`    | Business logic, validation    |
| Backend  | `taskRoutes`      | HTTP endpoints                |
| API      | `tasksClient`     | Type-safe API calls           |
| Core     | `Task.ts`         | Domain model, transformations |
| Core     | `tasksService.ts` | Platform-agnostic service     |
| UI       | `useTasksList`    | State management hook         |
| UI       | `TasksPanel`      | Panel orchestrator            |
| UI       | `TasksList`       | List with filtering           |
| UI       | `TaskItem`        | Individual task component     |

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  ┌──────────┐    ┌────────────┐    ┌───────────────────┐    │
│  │ TaskItem │───▶│ TasksList  │───▶│   TasksPanel      │    │
│  └──────────┘    └────────────┘    └───────────────────┘    │
│                         │                     │             │
│                         ▼                     ▼             │
│                  ┌─────────────────────────────────────┐    │
│                  │           useTasksList              │    │
│                  │   (state, optimistic updates)       │    │
│                  └─────────────────────────────────────┘    │
└───────────────────────────────│─────────────────────────────┘
                                │
┌───────────────────────────────│─────────────────────────────┐
│                        Core Layer                           │
│                  ┌─────────────────────────────────────┐    │
│                  │         TasksService                │    │
│                  │   (platform-agnostic interface)     │    │
│                  └─────────────────────────────────────┘    │
│                               │                             │
│                  ┌─────────────────────────────────────┐    │
│                  │           Task.ts                   │    │
│                  │   (domain model, transformations)   │    │
│                  └─────────────────────────────────────┘    │
└───────────────────────────────│─────────────────────────────┘
                                │
┌───────────────────────────────│─────────────────────────────┐
│                        API Layer                            │
│                  ┌─────────────────────────────────────┐    │
│                  │          tasksClient                │    │
│                  │   (HTTP calls, validation)          │    │
│                  └─────────────────────────────────────┘    │
└───────────────────────────────│─────────────────────────────┘
                                │
┌───────────────────────────────│─────────────────────────────┐
│                      Backend Layer                          │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  taskRoutes     │───▶│  tasksService   │                │
│  │  (HTTP layer)   │    │  (business)     │                │
│  └─────────────────┘    └─────────────────┘                │
│                                │                            │
│                         ┌──────────────┐                   │
│                         │ tasksRepo    │                   │
│                         │ (database)   │                   │
│                         └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 500),
  description TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  course_code TEXT CHECK (char_length(course_code) <= 20),
  source_url TEXT CHECK (char_length(source_url) <= 2000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Key Design Decisions

1. **`sort_order`**: Enables drag-and-drop reordering
2. **`completed_at`**: Auto-populated by trigger on completion
3. **`course_code`**: Lightweight tagging without foreign key complexity
4. **RLS policies**: User can only access their own tasks

## API Endpoints

| Method   | Path                    | Description               |
| -------- | ----------------------- | ------------------------- |
| `POST`   | `/api/tasks`            | Create task               |
| `GET`    | `/api/tasks`            | List tasks (with filters) |
| `GET`    | `/api/tasks/:id`        | Get single task           |
| `PUT`    | `/api/tasks/:id`        | Update task               |
| `DELETE` | `/api/tasks/:id`        | Delete task               |
| `PATCH`  | `/api/tasks/:id/toggle` | Toggle completion         |
| `POST`   | `/api/tasks/reorder`    | Batch reorder             |

### Query Parameters (List)

- `courseCode`: Filter by course
- `completed`: Filter by completion status
- `limit`: Max results (default 100)
- `offset`: Pagination offset
- `includeCompleted`: Include completed tasks (default true)

## UI Components

### TasksPanel

Root container that orchestrates:

- Tab rendering via `LockInSidebar`
- Header with stats via `TasksPanelHeader`
- List with filtering via `TasksList`
- State management via `useTasksList`

### TasksList

Renders filtered task list with:

- Filter tabs: All, Active, Completed, by Course
- Quick-add input field
- Empty state handling
- Virtual scrolling ready (not yet implemented)

### TaskItem

Individual checklist item with:

- Checkbox for completion toggle
- Inline-editable title (contentEditable)
- Delete button (appears on hover)
- Course badge (if tagged)
- Optimistic UI updates

### useTasksList Hook

Central state manager providing:

- Task list with local state
- CRUD operations
- Optimistic updates with rollback
- Request deduplication
- Error handling

## Extension Points

### Future AI Integration

The architecture supports these planned AI features:

1. **Auto-extraction**: Parse lecture transcripts for actionable items
2. **Smart suggestions**: "Based on your notes, you might want to..."
3. **Priority prediction**: ML-based importance scoring
4. **Due date inference**: Extract deadlines from context

Integration points:

- `TasksService.createTask()` accepts AI-generated tasks
- `Task.sourceUrl` tracks origin for attribution
- `Task.description` stores AI-generated context

### Recurring Tasks (Not Implemented)

Schema supports extension:

```sql
ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
ALTER TABLE tasks ADD COLUMN parent_task_id UUID REFERENCES tasks(id);
```

### Sub-tasks (Not Implemented)

Could be added via self-referential relationship:

```sql
ALTER TABLE tasks ADD COLUMN parent_id UUID REFERENCES tasks(id);
```

## Performance Considerations

### Optimistic Updates

All mutations use optimistic updates:

1. Update local state immediately
2. Send API request
3. Rollback on failure

This eliminates perceived latency for common operations.

### Request Deduplication

`useTasksList` prevents duplicate requests:

```typescript
const loadingRef = useRef(false);
if (loadingRef.current) return; // Skip if already loading
```

### Efficient Queries

Database indexes optimize common queries:

- `idx_tasks_user_sort`: User's ordered list
- `idx_tasks_user_course`: Filter by course
- `idx_tasks_user_incomplete`: Active tasks only

## Testing Strategy

| Level       | Location                                          | Focus                  |
| ----------- | ------------------------------------------------- | ---------------------- |
| Unit        | `core/domain/__tests__/Task.test.ts`              | Domain transformations |
| Unit        | `core/services/__tests__/tasksService.test.ts`    | Service contracts      |
| Unit        | `backend/services/__tests__/tasksService.test.js` | Business logic         |
| Integration | `ui/hooks/__tests__/useTasksList.test.ts`         | Hook behavior          |

## Related Documentation

- [Database Schema](../reference/DATABASE.md)
- [API Client Patterns](../reference/CODE_OVERVIEW.md)
- [UI Component Patterns](../reference/CODE_OVERVIEW.md)
