import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTasksService, type TasksApiClient } from '../tasksService';
import type { Task } from '../../domain/Task';

const mockTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: null,
  completed: false,
  completedAt: null,
  dueDate: null,
  courseCode: 'FIT1045',
  sourceUrl: 'https://example.com',
  sortOrder: 0,
  workflowStatus: 'backlog',
  week: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function createMockApiClient(): TasksApiClient {
  return {
    listTasks: vi.fn().mockResolvedValue([mockTask]),
    getTask: vi.fn().mockResolvedValue(mockTask),
    createTask: vi.fn().mockResolvedValue(mockTask),
    updateTask: vi.fn().mockResolvedValue(mockTask),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    toggleTaskCompleted: vi.fn().mockResolvedValue({ ...mockTask, completed: true }),
    reorderTasks: vi.fn().mockResolvedValue(undefined),
  };
}

describe('TasksService', () => {
  let apiClient: TasksApiClient;
  let service: ReturnType<typeof createTasksService>;

  beforeEach(() => {
    apiClient = createMockApiClient();
    service = createTasksService(apiClient);
  });

  describe('listTasks', () => {
    it('returns normalized tasks from API', async () => {
      const tasks = await service.listTasks();

      expect(apiClient.listTasks).toHaveBeenCalledWith({
        includeCompleted: true,
        limit: 100,
      });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.id).toBe('task-1');
    });

    it('passes filter parameters', async () => {
      await service.listTasks({
        courseCode: 'FIT2000',
        includeCompleted: false,
        limit: 50,
      });

      expect(apiClient.listTasks).toHaveBeenCalledWith({
        courseCode: 'FIT2000',
        includeCompleted: false,
        limit: 50,
      });
    });

    it('handles null courseCode', async () => {
      await service.listTasks({ courseCode: null });

      expect(apiClient.listTasks).toHaveBeenCalledWith({
        courseCode: undefined,
        includeCompleted: true,
        limit: 100,
      });
    });
  });

  describe('getTask', () => {
    it('returns normalized task', async () => {
      const task = await service.getTask('task-1');

      expect(apiClient.getTask).toHaveBeenCalledWith('task-1');
      expect(task.id).toBe('task-1');
    });

    it('throws error for missing taskId', async () => {
      await expect(service.getTask('')).rejects.toThrow('Task ID is required');
    });
  });

  describe('createTask', () => {
    it('creates task with required fields', async () => {
      const task = await service.createTask({
        title: 'New Task',
        courseCode: 'FIT1045',
        sourceUrl: 'https://example.com',
      });

      expect(apiClient.createTask).toHaveBeenCalledWith(
        {
          title: 'New Task',
          description: null,
          dueDate: null,
          courseCode: 'FIT1045',
          sourceUrl: 'https://example.com',
          week: null,
        },
        {},
      );
      expect(task.id).toBe('task-1');
    });

    it('trims title whitespace', async () => {
      await service.createTask({ title: '  Trimmed Task  ' });

      expect(apiClient.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Trimmed Task' }),
        expect.any(Object),
      );
    });

    it('throws error for empty title', async () => {
      await expect(service.createTask({ title: '' })).rejects.toThrow('Task title is required');
    });

    it('throws error for whitespace-only title', async () => {
      await expect(service.createTask({ title: '   ' })).rejects.toThrow('Task title is required');
    });
  });

  describe('updateTask', () => {
    it('updates task with changes', async () => {
      const task = await service.updateTask('task-1', { title: 'Updated' });

      expect(apiClient.updateTask).toHaveBeenCalledWith(
        'task-1',
        { title: 'Updated' },
        { signal: undefined, ifUnmodifiedSince: undefined },
      );
      expect(task.id).toBe('task-1');
    });

    it('throws error for missing taskId', async () => {
      await expect(service.updateTask('', { title: 'Test' })).rejects.toThrow(
        'Task ID is required',
      );
    });

    it('throws error for empty title', async () => {
      await expect(service.updateTask('task-1', { title: '' })).rejects.toThrow(
        'Task title cannot be empty',
      );
    });

    it('passes optimistic locking header', async () => {
      await service.updateTask(
        'task-1',
        { title: 'Updated' },
        { expectedUpdatedAt: '2026-01-01T00:00:00Z' },
      );

      expect(apiClient.updateTask).toHaveBeenCalledWith(
        'task-1',
        { title: 'Updated' },
        { signal: undefined, ifUnmodifiedSince: '2026-01-01T00:00:00Z' },
      );
    });
  });

  describe('deleteTask', () => {
    it('deletes task by id', async () => {
      await service.deleteTask('task-1');

      expect(apiClient.deleteTask).toHaveBeenCalledWith('task-1');
    });

    it('throws error for missing taskId', async () => {
      await expect(service.deleteTask('')).rejects.toThrow('Task ID is required');
    });
  });

  describe('toggleCompleted', () => {
    it('toggles task completion', async () => {
      const task = await service.toggleCompleted('task-1');

      expect(apiClient.toggleTaskCompleted).toHaveBeenCalledWith('task-1');
      expect(task.completed).toBe(true);
    });

    it('throws error for missing taskId', async () => {
      await expect(service.toggleCompleted('')).rejects.toThrow('Task ID is required');
    });
  });

  describe('reorderTasks', () => {
    it('reorders multiple tasks', async () => {
      await service.reorderTasks([
        { taskId: 'task-1', sortOrder: 0 },
        { taskId: 'task-2', sortOrder: 1 },
      ]);

      expect(apiClient.reorderTasks).toHaveBeenCalledWith([
        { taskId: 'task-1', sortOrder: 0 },
        { taskId: 'task-2', sortOrder: 1 },
      ]);
    });

    it('does nothing for empty array', async () => {
      await service.reorderTasks([]);

      expect(apiClient.reorderTasks).not.toHaveBeenCalled();
    });
  });
});
