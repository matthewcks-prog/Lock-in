const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../../app');
const taskRoutes = require('../taskRoutes');

function listRouteSignatures(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const methods = Object.keys(layer.route.methods).map((method) => method.toUpperCase());
      return methods.map((method) => `${method} ${layer.route.path}`);
    })
    .flat();
}

test('task routes contract exposes expected endpoints', () => {
  const signatures = listRouteSignatures(taskRoutes);

  assert.deepEqual(signatures, [
    'POST /tasks',
    'GET /tasks',
    'PUT /tasks/reorder',
    'GET /tasks/:taskId',
    'PUT /tasks/:taskId',
    'DELETE /tasks/:taskId',
    'PATCH /tasks/:taskId/toggle',
  ]);
});

test('application mounts task routes under /api', () => {
  const app = createApp();
  const mountedTaskRouters = app._router.stack.filter(
    (layer) => layer.name === 'router' && layer.handle === taskRoutes,
  );

  assert.equal(mountedTaskRouters.length, 1);
  assert.match(String(mountedTaskRouters[0].regexp), /\\\/api/);
});
