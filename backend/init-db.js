import bcrypt from 'bcryptjs';
import pool from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
    try {
        console.log('🔧 Initializing database...');

        // Read and execute schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        await pool.query(schema);
        console.log('✓ Database schema created successfully');

        // Create default admin with hashed password
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.query(
            `INSERT INTO admins (username, password_hash, full_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (username) DO UPDATE 
       SET password_hash = $2`,
            ['admin', passwordHash, 'System Administrator']
        );
        console.log('✓ Default admin created (username: admin, password: admin123)');

        console.log('✅ Database initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

initializeDatabase();
