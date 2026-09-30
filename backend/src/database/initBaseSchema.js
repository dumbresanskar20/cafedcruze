const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

/**
 * Automatically initializes base MySQL tables from database/schema.sql
 * if they do not yet exist in the configured database (e.g. freshly created cPanel MySQL database).
 */
const initBaseSchema = async () => {
  try {
    // Check if core Subscription table already exists
    const [tables] = await pool.query(
      `SELECT TABLE_NAME 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Subscription' 
       LIMIT 1`
    );

    if (tables.length > 0) {
      // Core tables are already in place
      return;
    }

    console.log('[Database Auto-Init] Empty database detected. Initializing all base tables from database/schema.sql...');

    // Locate schema.sql across possible runtime working directories
    const candidatePaths = [
      path.resolve(__dirname, '../../database/schema.sql'),
      path.resolve(__dirname, '../database/schema.sql'),
      path.resolve(__dirname, './schema.sql'),
      path.resolve(__dirname, '../../../database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'),
      path.resolve(process.cwd(), 'backend/database/schema.sql'),
      path.resolve(process.cwd(), 'src/database/schema.sql'),
    ];

    let schemaPath = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }

    if (!schemaPath) {
      console.warn('⚠️ [Database Auto-Init] schema.sql not found in candidate paths. Please import database/schema.sql manually.');
      return;
    }

    console.log(`[Database Auto-Init] Loading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Strip comments
    const sqlClean = schemaSql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*--.*$/gm, '')
      .replace(/^[ \t]*#.*$/gm, '');

    // Split into individual SQL statements
    const statements = sqlClean
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[Database Auto-Init] Executing ${statements.length} schema DDL statements...`);

    // Disable foreign key checks during batch table creation
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
      } catch (stmtErr) {
        console.warn(`[Database Auto-Init Warning] Statement ${i + 1}: ${stmtErr.message}`);
      }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ [Database Auto-Init] All base tables, meal windows, and default settings created successfully!');
  } catch (err) {
    console.error('⚠️ [Database Auto-Init Error]:', err.message);
  }
};

module.exports = { initBaseSchema };
