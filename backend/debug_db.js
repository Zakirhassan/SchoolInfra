import pool from './config/database.js';
async function test() {
    try {
        const res = await pool.query('SELECT document_url FROM student_documents LIMIT 1');
        console.log('DOCUMENT URL:', res.rows[0]?.document_url);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
