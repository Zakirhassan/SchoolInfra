import type { Env } from '../types';

const RULES = {
  image:    { ext: /\.(jpe?g|png)$/i,     prefix: 'photo', max: 5 * 1024 * 1024 },
  document: { ext: /\.(pdf|jpe?g|png)$/i, prefix: 'doc',   max: 5 * 1024 * 1024 },
};

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf',
};
export const ALLOWED_TYPES = new Set(Object.values(TYPES));
export const contentTypeForName = (name: string): string =>
  TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

export async function putUpload(env: Env, folder: 'photos' | 'documents', file: File, kind: 'image' | 'document') {
  const r = RULES[kind];
  if (!r.ext.test(file.name)) throw new Error(kind === 'image'
    ? 'Only JPEG, JPG, and PNG images are allowed' : 'Only PDF, JPEG, JPG, and PNG files are allowed');
  if (file.size > r.max) throw new Error('File too large (max 5MB)');
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const name = `${r.prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  await env.FILES.put(`${folder}/${name}`, await file.arrayBuffer(), { httpMetadata: { contentType: contentTypeForName(file.name) } });
  return `/uploads/${folder}/${name}`;
}

export const deleteUpload = (env: Env, url: string) => env.FILES.delete(url.replace(/^\/uploads\//, ''));
