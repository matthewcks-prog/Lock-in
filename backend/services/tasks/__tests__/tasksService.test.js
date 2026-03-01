const test = require('node:test');
const assert = require('node:assert/strict');

const { createTasksService } = require('../tasksService');
const { ConflictError } = require('../../../errors');

function createService(overrides = {}) {
  const tasksRepo = {
    getNextSortOrder: async () => 0,
    createTask: async (input) => ({ id: 'task-1', ...input }),
    listTasks: async () => [],
    getTask: async () => null,
    updateTask: async () => ({ id: 'task-1', title: 'Updated' }),
    toggleTaskCompleted: async () => ({ id: 'task-1', completed: true }),
    deleteTask: async () => true,
    reorderTasks: async () => true,
    ...overrides.tasksRepo,
  };

  const logger = {
    info: () => {},
    debug: () => {},
    ...overrides.logger,
  };

  const service = createTasksService({ tasksRepo, logger });
  return { service, tasksRepo };
}

test('listTasks clamps limit and keeps includeCompleted=false', async () => {
  let captured = null;
  const { service } = createService({
    tasksRepo: {
      listTasks: async (args) => {
        captured = args;
        return [];
      },
    },
  });

  await service.listTasks({
    userId: 'user-1',
    limit: 9999,
    includeCompleted: false,
  });

  assert.equal(captured.limit, 500);
  assert.equal(captured.includeCompleted, false);
});

test('createTask rejects missing title instead of crashing on undefined payload', async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.createTask({ userId: 'user-1', payload: undefined }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

test('updateTask remaps 404 repo error to NotFoundError', async () => {
  const { service } = createService({
    tasksRepo: {
      updateTask: async () => {
        const error = new Error('Task not found');
        error.status = 404;
        throw error;
      },
    },
  });

  await assert.rejects(
    () =>
      service.updateTask({
        userId: 'user-1',
        taskId: 'task-404',
        payload: { title: 'Updated' },
      }),
    (error) => error.code === 'NOT_FOUND',
  );
});

test('updateTask preserves conflict errors from repository', async () => {
  const { service } = createService({
    tasksRepo: {
      updateTask: async () => {
        throw new ConflictError('Conflict', '2026-02-21T00:00:00.000Z');
      },
    },
  });

  await assert.rejects(
    () =>
      service.updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        payload: { title: 'Updated' },
      }),
    (error) => error.code === 'CONFLICT' && error.updatedAt === '2026-02-21T00:00:00.000Z',
  );
});
