const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../../app');
const userRoutes = require('../userRoutes');

function listRouteSignatures(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const methods = Object.keys(layer.route.methods).map((method) => method.toUpperCase());
      return methods.map((method) => `${method} ${layer.route.path}`);
    })
    .flat();
}

test('user routes contract exposes expected endpoints', () => {
  const signatures = listRouteSignatures(userRoutes);

  assert.deepEqual(signatures, ['DELETE /users/me']);
});

test('application mounts user routes under /api', () => {
  const app = createApp();
  const mountedUserRouters = app._router.stack.filter(
    (layer) => layer.name === 'router' && layer.handle === userRoutes,
  );

  assert.equal(mountedUserRouters.length, 1);
  assert.match(String(mountedUserRouters[0].regexp), /\\\/api/);
});
