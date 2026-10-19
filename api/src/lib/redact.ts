// Strip credential fields before a row leaves the Worker as JSON.
// students rows come from `SELECT s.*` / `RETURNING *`, which include password_hash.
// No imports: this file is also run directly by node in tests.

export function withoutPasswordHash<T extends Record<string, any>>(row: T): Omit<T, 'password_hash'>;
export function withoutPasswordHash(row: null | undefined): null | undefined;
export function withoutPasswordHash(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const { password_hash, ...rest } = row;
  return rest;
}

export const rowsWithoutPasswordHash = <T extends Record<string, any>>(rows: T[]): Omit<T, 'password_hash'>[] =>
  rows.map((r) => withoutPasswordHash(r));
