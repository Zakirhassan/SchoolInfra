import pool from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const sqlPath = path.join(__dirname, 'migration_student_flow.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration successful!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
