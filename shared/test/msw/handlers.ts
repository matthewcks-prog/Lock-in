import { http, HttpResponse } from 'msw';

export const handlers = [
  // Example:
  // http.get('/api/example', () => HttpResponse.json({ ok: true })),
];

export { http, HttpResponse };
