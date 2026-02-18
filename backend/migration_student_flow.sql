-- Migration to add enrollment status to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(50) DEFAULT 'ACTIVE';

-- Update existing students to ACTIVE
UPDATE students SET enrollment_status = 'ACTIVE' WHERE enrollment_status IS NULL;

-- ENUM-like check constraint (optional but good for data integrity)
-- ALTER TABLE students ADD CONSTRAINT check_enrollment_status CHECK (enrollment_status IN ('ENTRANCE_EXAM', 'ACTIVE', 'ALUMNI'));
