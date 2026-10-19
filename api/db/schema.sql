-- ASDC School Management: complete schema for the Cloudflare Worker (api/).
--
-- Fresh start: there is no legacy data. This one file replaces backend/schema.sql and
-- backend/migration_asdc.sql, migration_phase2.sql, migration_student_flow.sql, plus the
-- exams.weightage column the code uses but no migration file ever created.
--
-- Idempotent: safe to run again (CREATE ... IF NOT EXISTS everywhere, no data inserted).
-- No default admin and no sample rows: create the first admin with
--   npm run seed:admin   (api/scripts/seed-admin.mjs)
--
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/db/schema.sql
--
-- Every table/column below is referenced by api/src/routes/*.ts or api/src/lib/*.ts.

BEGIN;

-- Admins (login by username; routes/auth.ts, routes/auditLogs.ts)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,      -- pbkdf2$100000$<b64salt>$<b64hash>
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teachers (login by username or email; routes/teachers.ts, routes/auth.ts)
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    photo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes a.k.a. courses (routes/classes.ts). teacher_id scopes TEACHER access everywhere.
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(20) NOT NULL,
    section VARCHAR(10) NOT NULL,
    monthly_fee DECIMAL(10, 2) DEFAULT 0,
    duration VARCHAR(50),
    start_date DATE,
    tentative_end_date DATE,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    UNIQUE (class_name, section)
);

-- Students (routes/students.ts, fees.ts, export.ts, idcards.ts, reports.ts; login by email)
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    admission_number VARCHAR(50) UNIQUE NOT NULL,
    roll_number VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100) NOT NULL,
    mother_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    address TEXT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    photo_url VARCHAR(255),
    fee_status VARCHAR(20) DEFAULT 'Unpaid' CHECK (fee_status IN ('Paid', 'Unpaid', 'Partial')),
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),               -- NULL = no student-portal login
    is_published BOOLEAN DEFAULT false,
    enrollment_status VARCHAR(50) DEFAULT 'ACTIVE', -- ENTRANCE_EXAM | ACTIVE | ALUMNI (checked in routes)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded student documents; document_url points into R2 (routes/students.ts)
CREATE TABLE IF NOT EXISTS student_documents (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    document_name VARCHAR(100) NOT NULL,
    document_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subjects (routes/subjects.ts)
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    max_marks INTEGER DEFAULT 100,
    UNIQUE (subject_name, class_id)
);

-- Exams (routes/subjects.ts). weightage: percent; routes keep the per-class sum <= 100.
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    exam_name VARCHAR(100) NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    exam_date DATE,
    academic_year VARCHAR(20) NOT NULL,
    weightage INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marks (routes/subjects.ts upserts ON CONFLICT (student_id, subject_id, exam_id))
CREATE TABLE IF NOT EXISTS marks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    marks_obtained DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, subject_id, exam_id)
);

-- Fee payments (routes/fees.ts)
CREATE TABLE IF NOT EXISTS fee_payments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_month VARCHAR(20) NOT NULL,
    payment_year INTEGER NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance (routes/attendance.ts upserts ON CONFLICT (student_id, course_id, attendance_date))
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('Present', 'Absent')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, course_id, attendance_date)
);

-- Audit log (lib/auth.ts logAction, routes/auditLogs.ts). user_id is an admin or teacher id.
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam ON marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, user_role);

COMMIT;
