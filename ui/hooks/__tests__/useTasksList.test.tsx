import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Task } from '@core/domain/Task';
import type { TasksService } from '@core/services/tasksService';
import { useTasksList } from '../useTasksList';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    completed: false,
    completedAt: null,
    dueDate: null,
    courseCode: 'FIT1045',
    sourceUrl: null,
    sortOrder: 0,
    workflowStatus: 'backlog',
    week: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createTasksServiceStub(overrides: Partial<TasksService> = {}): TasksService {
  return {
    listTasks: vi.fn().mockResolvedValue([]),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleCompleted: vi.fn(),
    reorderTasks: vi.fn(),
    ...overrides,
  } as TasksService;
}

interface HookResult {
  current: ReturnType<typeof useTasksList>;
}

function TestComponent({
  resultRef,
  tasksService,
}: {
  resultRef: HookResult;
  tasksService: TasksService | null;
}): JSX.Element | null {
  const hookResult = useTasksList({ tasksService });
  resultRef.current = hookResult;
  return null;
}

describe('useTasksList', () => {
  let container: HTMLDivElement;
  let root: Root;
  let resultRef: HookResult;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    resultRef = { current: {} as ReturnType<typeof useTasksList> };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('initializes with empty state when service is null', () => {
    act(() => {
      root.render(<TestComponent resultRef={resultRef} tasksService={null} />);
    });

    expect(resultRef.current.tasks).toEqual([]);
    expect(resultRef.current.isLoading).toBe(false);
    expect(resultRef.current.error).toBe(null);
  });

  it('exposes expected interface', async () => {
    const service = createTasksServiceStub({
      listTasks: vi.fn().mockResolvedValue([createTask()]),
    });

    await act(async () => {
      root.render(<TestComponent resultRef={resultRef} tasksService={service} />);
    });

    // Verify hook interface
    expect(resultRef.current).toHaveProperty('tasks');
    expect(resultRef.current).toHaveProperty('isLoading');
    expect(resultRef.current).toHaveProperty('error');
    expect(resultRef.current).toHaveProperty('refresh');
    expect(resultRef.current).toHaveProperty('createTask');
    expect(resultRef.current).toHaveProperty('updateTask');
    expect(resultRef.current).toHaveProperty('deleteTask');
    expect(resultRef.current).toHaveProperty('toggleCompleted');
    expect(resultRef.current).toHaveProperty('clearError');

    expect(typeof resultRef.current.refresh).toBe('function');
    expect(typeof resultRef.current.createTask).toBe('function');
  });
});
