-- Migration Phase 2: Teacher Expansion, Course Meta-data, and Audit Logs

-- 1. Add new fields to Classes (Courses)
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS duration VARCHAR(50),
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS tentative_end_date DATE,
ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL;

-- 2. Add photo_url to Teachers (if not already there)
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255);

-- 3. Ensure students has photo_url (it should already be there from schema.sql)
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255);

-- 4. Create Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- ID of the admin or teacher
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(255) NOT NULL, -- e.g., 'CREATE_STUDENT', 'UPDATE_MARKS'
    details TEXT, -- JSON or descriptive text
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, user_role);
