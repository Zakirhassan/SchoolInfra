import pool from './config/database.js';

async function checkStudents() {
    try {
        const result = await pool.query('SELECT id, admission_number, full_name, class_id FROM students ORDER BY id LIMIT 20');
        console.log('Students in database:');
        console.table(result.rows);

        const classResult = await pool.query('SELECT id, class_name, section FROM classes');
        console.log('\nClasses in database:');
        console.table(classResult.rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkStudents();
