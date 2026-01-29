function extractIdempotencyKey(req) {
  const headerValue =
    (typeof req.get === 'function' && req.get('Idempotency-Key')) ||
    req.headers?.['idempotency-key'];
  const bodyValue = req.body?.idempotencyKey;
  const candidate =
    (typeof headerValue === 'string' && headerValue.trim()) ||
    (typeof bodyValue === 'string' && bodyValue.trim());
  return candidate || null;
}

module.exports = {
  extractIdempotencyKey,
};
