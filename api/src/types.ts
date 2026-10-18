import type { Pool } from '@neondatabase/serverless';
export type Env = { DATABASE_URL: string; JWT_SECRET: string; FRONTEND_URL: string; FILES: R2Bucket };
export type User = { id: number; username: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };
export type AppCtx = { Bindings: Env; Variables: { db: Pool; user: User } };
