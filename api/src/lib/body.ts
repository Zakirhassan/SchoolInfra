import type { Context } from 'hono';
export async function readBody(c: Context): Promise<Record<string, any>> {
  const type = c.req.header('content-type') ?? '';
  if (!type.includes('application/json')) return await c.req.parseBody();
  try {
    const body = await c.req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
