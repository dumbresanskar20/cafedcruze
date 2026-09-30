const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { getDbConfig } = require('./database/db');

const runSetup = async () => {
  const dbConfig = getDbConfig();
  const { host, port, user, password, database, ssl } = dbConfig;

  console.log(`[Setup] Connecting to MySQL at ${host}:${port} as ${user}...`);

  try {
    // Connect without selecting database first
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      ssl,
    });

    console.log(`[Setup] Connected! Creating database if not exists: \`${database}\`...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);

    console.log('[Setup] Database ready. Reading schema DDL from database/schema.sql...');
    const candidateSchemaPaths = [
      path.join(__dirname, '..', 'database', 'schema.sql'),
      path.join(__dirname, 'database', 'schema.sql'),
      path.join(__dirname, 'schema.sql'),
      path.join(process.cwd(), 'database', 'schema.sql'),
      path.join(process.cwd(), 'backend', 'database', 'schema.sql'),
    ];

    let schemaPath = null;
    for (const p of candidateSchemaPaths) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }

    if (!schemaPath) {
      throw new Error('database/schema.sql not found in candidate paths.');
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Remove SQL comments and clean up queries
    const sqlClean = schemaSql
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* block comments */
      .replace(/^[ \t]*--.*$/gm, '')    // Remove -- line comments
      .replace(/^[ \t]*#.*$/gm, '');    // Remove # line comments

    // Split schema queries by semicolon
    const queries = sqlClean
      .split(';')
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    console.log(`[Setup] Executing ${queries.length} schema table DDL queries...`);
    for (let i = 0; i < queries.length; i++) {
      try {
        await connection.query(queries[i]);
      } catch (queryErr) {
        console.warn(`[Setup] Query ${i + 1} warning: ${queryErr.message}`);
      }
    }

    console.log('✅ [Setup] Schema and table structures created successfully!');
    await connection.end();
    
    // Now trigger seeding
    console.log('[Setup] Executing initial data seeding...');
    require('./seed.js');
  } catch (error) {
    console.error('❌ [Setup Error] Failed to initialize database:', error.message);
  }
};

runSetup();
