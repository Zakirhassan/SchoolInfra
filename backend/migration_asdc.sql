-- Migration for ASDC Rebranding
-- Run this to update the schema to support new roles and features

-- 1. Create Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Update Students table for Credentials and Publishing
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- 3. Create Student Documents table
CREATE TABLE IF NOT EXISTS student_documents (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    document_name VARCHAR(100) NOT NULL,
    document_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('Present', 'Absent')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id, attendance_date)
);

-- 5. Add index for attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);

-- Insert a sample teacher (password: teacher123)
-- Hash for 'teacher123' using bcrypt: $2a$10$7qz9Q5tF1zG0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w
-- INSERT INTO teachers (username, password_hash, full_name, email)
-- VALUES ('teacher1', '$2a$10$7qz9Q5tF1zG0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w1C0w', 'Sample Teacher', 'teacher1@asdc.com')
-- ON CONFLICT (username) DO NOTHING;
