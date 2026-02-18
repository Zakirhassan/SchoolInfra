import pool from './config/database.js';

async function fixDocumentUrls() {
    try {
        console.log('Fixing document URLs with spaces...');

        const result = await pool.query(`
            UPDATE student_documents 
            SET document_url = TRIM(REPLACE(REPLACE(REPLACE(document_url, ' / ', '/'), '/ ', '/'), ' /', '/'))
            WHERE document_url LIKE '% %'
            RETURNING id, document_name, document_url
        `);

        console.log(`Fixed ${result.rowCount} document URLs:`);
        result.rows.forEach(row => {
            console.log(`  - ID ${row.id}: ${row.document_url}`);
        });

        // Verify all documents
        const allDocs = await pool.query('SELECT id, document_name, document_url FROM student_documents');
        console.log('\nAll documents after fix:');
        allDocs.rows.forEach(row => {
            console.log(`  - ${row.document_name}: ${row.document_url}`);
        });

    } catch (error) {
        console.error('Error fixing document URLs:', error);
    } finally {
        process.exit();
    }
}

fixDocumentUrls();
