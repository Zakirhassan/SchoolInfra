import type { Pool } from '@neondatabase/serverless';
export type Env = { DATABASE_URL: string; JWT_SECRET: string; FRONTEND_URL: string; FILES: R2Bucket;
  // Optional school details for ID cards / certificates (old backend read these from process.env).
  SCHOOL_NAME?: string; SCHOOL_ADDRESS?: string; SCHOOL_PHONE?: string; CURRENT_ACADEMIC_YEAR?: string };
export type User = { id: number; username: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };
export type AppCtx = { Bindings: Env; Variables: { db: Pool; user: User } };
