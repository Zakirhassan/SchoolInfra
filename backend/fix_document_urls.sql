-- Fix document URLs with spaces
UPDATE student_documents 
SET document_url = TRIM(REPLACE(REPLACE(REPLACE(document_url, ' / ', '/'), '/ ', '/'), ' /', '/'))
WHERE document_url LIKE '% %';

-- Verify the fix
SELECT id, document_name, document_url FROM student_documents;
