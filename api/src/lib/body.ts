import type { Context } from 'hono';
export async function readBody(c: Context): Promise<Record<string, any>> {
  const type = c.req.header('content-type') ?? '';
  return type.includes('application/json') ? await c.req.json() : await c.req.parseBody();
}
