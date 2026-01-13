-- School Management System Database Schema

-- Create database (run this separately if needed)
-- CREATE DATABASE school_management;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    class_name VARCHAR(20) NOT NULL,
    section VARCHAR(10) NOT NULL,
    monthly_fee DECIMAL(10, 2) DEFAULT 0,
    UNIQUE(class_name, section)
);

-- Students table
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    max_marks INTEGER DEFAULT 100,
    UNIQUE(subject_name, class_id)
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    exam_name VARCHAR(100) NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    exam_date DATE,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marks table
CREATE TABLE IF NOT EXISTS marks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    marks_obtained DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id, exam_id)
);

-- Fee payments table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_admission ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam ON marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);

-- Insert default admin (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO admins (username, password_hash, full_name) 
VALUES ('admin', '$2a$10$rKZLvVZqKqVZqKqVZqKqVeO7qKqVZqKqVZqKqVZqKqVZqKqVZqKqV', 'System Administrator')
ON CONFLICT (username) DO NOTHING;

-- Insert sample classes
INSERT INTO classes (class_name, section, monthly_fee) VALUES
('1', 'A', 1000),
('1', 'B', 1000),
('2', 'A', 1200),
('2', 'B', 1200),
('3', 'A', 1500),
('3', 'B', 1500),
('4', 'A', 1500),
('4', 'B', 1500),
('5', 'A', 2000),
('5', 'B', 2000),
('6', 'A', 2000),
('6', 'B', 2000),
('7', 'A', 2500),
('7', 'B', 2500),
('8', 'A', 2500),
('8', 'B', 2500),
('9', 'A', 3000),
('9', 'B', 3000),
('10', 'A', 3000),
('10', 'B', 3000)
ON CONFLICT (class_name, section) DO NOTHING;
