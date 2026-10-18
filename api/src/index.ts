import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppCtx } from './types';
import { withDb } from './lib/db';
import auth from './routes/auth';
import classes from './routes/classes';

const app = new Hono<AppCtx>();
app.use('*', (c, next) => cors({ origin: c.env.FRONTEND_URL || '*', credentials: true })(c, next));
app.get('/health', (c) => c.json({ status: 'OK', message: 'School Management System API is running' }));

app.get('/uploads/*', async (c) => {
  const obj = await c.env.FILES.get(c.req.path.replace(/^\/uploads\//, ''));
  if (!obj) return c.json({ error: 'Route not found' }, 404);
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' } });
});

app.use('/api/*', withDb);
app.route('/api/auth', auth);
app.route('/api/classes', classes);

app.notFound((c) => c.json({ error: 'Route not found' }, 404));
app.onError((err, c) => { console.error(err); return c.json({ error: 'Something went wrong!' }, 500); });
export default app;
