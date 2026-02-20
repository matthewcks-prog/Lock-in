import { describe, it, expect } from 'vitest';
import { createEmptyTask, isTaskDirty, normalizeTask, taskToPayload, type Task } from '../Task';

describe('Task domain model', () => {
  describe('createEmptyTask', () => {
    it('creates a task with default values', () => {
      const task = createEmptyTask();

      expect(task).toEqual({
        id: null,
        title: '',
        description: null,
        completed: false,
        completedAt: null,
        dueDate: null,
        courseCode: null,
        sourceUrl: null,
        sortOrder: 0,
        createdAt: null,
        updatedAt: null,
        workflowStatus: 'backlog',
        week: null,
      });
    });

    it('applies provided defaults', () => {
      const task = createEmptyTask({
        courseCode: 'FIT1045',
        sourceUrl: 'https://example.com',
      });

      expect(task.courseCode).toBe('FIT1045');
      expect(task.sourceUrl).toBe('https://example.com');
      expect(task.title).toBe('');
      expect(task.completed).toBe(false);
    });

    it('overrides defaults with explicit values', () => {
      const task = createEmptyTask({
        title: 'My Task',
        completed: true,
        courseCode: 'FIT2000',
      });

      expect(task.title).toBe('My Task');
      expect(task.completed).toBe(true);
      expect(task.courseCode).toBe('FIT2000');
    });
  });

  describe('isTaskDirty', () => {
    it('returns true for new task with title', () => {
      const task = createEmptyTask({ title: 'New Task' });
      expect(isTaskDirty(task, null)).toBe(true);
    });

    it('returns false for empty new task', () => {
      const task = createEmptyTask();
      expect(isTaskDirty(task, null)).toBe(false);
    });

    it('returns false for whitespace-only title', () => {
      const task = createEmptyTask({ title: '   ' });
      expect(isTaskDirty(task, null)).toBe(false);
    });

    it('returns false when task matches original', () => {
      const original = createEmptyTask({ title: 'Original', id: '1' });
      const task = { ...original };
      expect(isTaskDirty(task, original)).toBe(false);
    });

    it('returns true when title changed', () => {
      const original = createEmptyTask({ title: 'Original', id: '1' });
      const task = { ...original, title: 'Updated' };
      expect(isTaskDirty(task, original)).toBe(true);
    });

    it('returns true when description changed', () => {
      const original = createEmptyTask({ title: 'Task', description: 'Old', id: '1' });
      const task = { ...original, description: 'New' };
      expect(isTaskDirty(task, original)).toBe(true);
    });

    it('returns true when completed changed', () => {
      const original = createEmptyTask({ title: 'Task', id: '1' });
      const task = { ...original, completed: true };
      expect(isTaskDirty(task, original)).toBe(true);
    });

    it('returns true when dueDate changed', () => {
      const original = createEmptyTask({ title: 'Task', id: '1' });
      const task = { ...original, dueDate: '2026-03-01T00:00:00Z' };
      expect(isTaskDirty(task, original)).toBe(true);
    });

    it('returns true when courseCode changed', () => {
      const original = createEmptyTask({ title: 'Task', courseCode: 'FIT1045', id: '1' });
      const task = { ...original, courseCode: 'FIT2000' };
      expect(isTaskDirty(task, original)).toBe(true);
    });
  });

  describe('normalizeTask', () => {
    it('normalizes snake_case to camelCase', () => {
      const raw = {
        id: '123',
        title: 'Test Task',
        description: 'A description',
        completed: true,
        completed_at: '2026-01-15T10:00:00Z',
        due_date: '2026-02-01T00:00:00Z',
        course_code: 'FIT1045',
        source_url: 'https://example.com',
        sort_order: 5,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-10T00:00:00Z',
      };

      const task = normalizeTask(raw);

      expect(task).toEqual({
        id: '123',
        title: 'Test Task',
        description: 'A description',
        completed: true,
        completedAt: '2026-01-15T10:00:00Z',
        dueDate: '2026-02-01T00:00:00Z',
        courseCode: 'FIT1045',
        sourceUrl: 'https://example.com',
        sortOrder: 5,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
        workflowStatus: 'backlog',
        week: null,
      });
    });

    it('handles camelCase input', () => {
      const raw = {
        id: '456',
        title: 'Camel Case Task',
        completed: false,
        completedAt: null,
        dueDate: null,
        courseCode: 'FIT2000',
        sourceUrl: null,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const task = normalizeTask(raw);

      expect(task.courseCode).toBe('FIT2000');
      expect(task.completedAt).toBe(null);
    });

    it('handles missing fields', () => {
      const raw = {
        id: '789',
        title: 'Minimal Task',
      };

      const task = normalizeTask(raw);

      expect(task.id).toBe('789');
      expect(task.title).toBe('Minimal Task');
      expect(task.description).toBe(null);
      expect(task.completed).toBe(false);
      expect(task.sortOrder).toBe(0);
    });
  });

  describe('taskToPayload', () => {
    it('converts task to API payload', () => {
      const task: Partial<Task> = {
        title: 'Updated Task',
        description: 'New description',
        completed: true,
        dueDate: '2026-03-01T00:00:00Z',
        courseCode: 'FIT3000',
        sourceUrl: 'https://example.com/page',
        sortOrder: 10,
      };

      const payload = taskToPayload(task);

      expect(payload).toEqual({
        title: 'Updated Task',
        description: 'New description',
        completed: true,
        dueDate: '2026-03-01T00:00:00Z',
        courseCode: 'FIT3000',
        sourceUrl: 'https://example.com/page',
        sortOrder: 10,
      });
    });

    it('only includes defined fields', () => {
      const task: Partial<Task> = {
        title: 'Only Title',
      };

      const payload = taskToPayload(task);

      expect(payload).toEqual({ title: 'Only Title' });
      expect(Object.keys(payload)).toEqual(['title']);
    });

    it('returns empty object for empty input', () => {
      const payload = taskToPayload({});
      expect(payload).toEqual({});
    });

    it('excludes undefined values but includes null', () => {
      const task: Partial<Task> = {
        title: 'Task',
        description: null,
      };

      const payload = taskToPayload(task);

      expect(payload).toEqual({
        title: 'Task',
        description: null,
      });
    });
  });
});
