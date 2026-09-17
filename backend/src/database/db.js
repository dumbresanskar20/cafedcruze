const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Helper to clean and unwrap environment strings
const cleanEnvStr = (val) => {
  if (val === undefined || val === null) return undefined;
  const str = String(val).trim().replace(/^['"]+|['"]+$/g, '');
  return str.length > 0 ? str : undefined;
};

// 1. Ensure .env is loaded safely without overriding existing runtime (cPanel/system) variables
const initEnv = () => {
  const candidateEnvPaths = [
    path.resolve(__dirname, '../../.env'),         // backend/.env (from backend/src/database)
    path.resolve(__dirname, '../.env'),            // backend/src/.env
    path.resolve(process.cwd(), '.env'),           // .env in current working directory
    path.resolve(process.cwd(), 'backend/.env'),   // backend/.env relative to cwd
  ];

  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      // NOTE: Do NOT use override: true so that cPanel runtime environment variables are preserved
      dotenv.config({ path: envPath });
      return envPath;
    }
  }

  dotenv.config();
  return null;
};

const loadedEnvFile = initEnv();

// 2. Resolve database configuration supporting all standard aliases and protecting against stale DATABASE_URL
const resolveDbConfig = () => {
  // Check for DATABASE_URL (if provided and not a placeholder template)
  let urlConfig = {};
  const rawDatabaseUrl = cleanEnvStr(process.env.DATABASE_URL);
  if (
    rawDatabaseUrl &&
    !rawDatabaseUrl.includes('user:password@host:port') &&
    !rawDatabaseUrl.includes('YourDatabase')
  ) {
    try {
      const parsedUrl = new URL(rawDatabaseUrl);
      urlConfig = {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port, 10) || 3306,
        user: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
        password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
        database: parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : undefined,
        ssl:
          parsedUrl.searchParams.get('ssl-mode') ||
          rawDatabaseUrl.includes('ssl-mode') ||
          parsedUrl.hostname.includes('aivencloud.com')
            ? { rejectUnauthorized: false }
            : undefined,
      };
    } catch (err) {
      console.warn('[Database] Note: Unable to parse DATABASE_URL as URL. Using individual credentials.');
    }
  }

  // Explicit individual variables always take precedence over DATABASE_URL
  const host =
    cleanEnvStr(process.env.DB_HOST) ||
    cleanEnvStr(process.env.DATABASE_HOST) ||
    cleanEnvStr(process.env.MYSQL_HOST) ||
    cleanEnvStr(process.env.MYSQLHOST) ||
    urlConfig.host ||
    'localhost';

  const port =
    parseInt(
      cleanEnvStr(process.env.DB_PORT) ||
      cleanEnvStr(process.env.DATABASE_PORT) ||
      cleanEnvStr(process.env.MYSQL_PORT) ||
      cleanEnvStr(process.env.MYSQLPORT) ||
      urlConfig.port,
      10
    ) || 3306;

  const user =
    cleanEnvStr(process.env.DB_USER) ||
    cleanEnvStr(process.env.DB_USERNAME) ||
    cleanEnvStr(process.env.DATABASE_USER) ||
    cleanEnvStr(process.env.MYSQL_USER) ||
    cleanEnvStr(process.env.MYSQLUSER) ||
    urlConfig.user ||
    'root';

  const rawPassword =
    process.env.DB_PASSWORD !== undefined
      ? cleanEnvStr(process.env.DB_PASSWORD)
      : process.env.DB_PASS !== undefined
      ? cleanEnvStr(process.env.DB_PASS)
      : process.env.DATABASE_PASSWORD !== undefined
      ? cleanEnvStr(process.env.DATABASE_PASSWORD)
      : process.env.MYSQL_PASSWORD !== undefined
      ? cleanEnvStr(process.env.MYSQL_PASSWORD)
      : process.env.MYSQLPASSWORD !== undefined
      ? cleanEnvStr(process.env.MYSQLPASSWORD)
      : urlConfig.password;

  const password = rawPassword !== undefined ? rawPassword : '';

  const database =
    cleanEnvStr(process.env.DB_NAME) ||
    cleanEnvStr(process.env.DB_DATABASE) ||
    cleanEnvStr(process.env.DATABASE_NAME) ||
    cleanEnvStr(process.env.MYSQL_DATABASE) ||
    cleanEnvStr(process.env.MYSQLDATABASE) ||
    urlConfig.database ||
    '';

  const enableSsl =
    cleanEnvStr(process.env.DB_SSL) === 'true' ||
    cleanEnvStr(process.env.MYSQL_SSL) === 'true' ||
    Boolean(urlConfig.ssl);

  const ssl = enableSsl ? { rejectUnauthorized: false } : undefined;

  const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10;

  return {
    host,
    port,
    user,
    password,
    database,
    ssl,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    connectTimeout: 10000,
  };
};

const poolConfig = resolveDbConfig();

// Automatically cast TINYINT(1) fields to JavaScript booleans
poolConfig.typeCast = function (field, next) {
  if (field.type === 'TINY' && field.length === 1) {
    return field.string() === '1';
  }
  return next();
};

const pool = mysql.createPool(poolConfig);

// Diagnostic configuration log
const envSourceInfo = loadedEnvFile ? `loaded from ${loadedEnvFile}` : 'cPanel/system environment';
console.log(`[Database Config] Target: ${poolConfig.user || 'root'}@${poolConfig.host}:${poolConfig.port}/${poolConfig.database || '(none)'} [Config source: ${envSourceInfo}]`);

// Connection health tracking
let isDbConnected = false;
let lastDbError = null;

const getDatabaseStatus = () => ({
  connected: isDbConnected,
  database: poolConfig.database || null,
  host: poolConfig.host,
  port: poolConfig.port,
  user: poolConfig.user,
  lastError: lastDbError ? lastDbError.message : null,
});

/**
 * Attempts to automatically create the database if it doesn't exist yet
 * (supported if user has CREATE privileges, e.g. root, VPS, or privileged MySQL user).
 */
const ensureDatabaseExists = async (config) => {
  if (!config.database) return false;
  try {
    const tempConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      connectTimeout: 5000,
    });
    await tempConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await tempConn.end();
    console.log(`[Database] Verified/ensured database \`${config.database}\` is present on MySQL server.`);
    return true;
  } catch (err) {
    if (err.code === 'ER_DBACCESS_DENIED_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.warn(
        `[Database Notice] Database \`${config.database}\` does not exist and user \`${config.user}\` does not have CREATE DATABASE privilege.` +
        `\n👉 If hosted on cPanel, please create the database \`${config.database}\` via cPanel > 'MySQL Databases' and grant user \`${config.user}\` ALL PRIVILEGES.`
      );
    } else {
      console.warn(`[Database Notice] Database check notice: ${err.message}`);
    }
    return false;
  }
};

/**
 * Connect to database and verify connection pool on server startup
 */
const connectDB = async (retries = 3, delay = 2000) => {
  // Proactively ensure database exists if user has privileges
  if (poolConfig.database) {
    await ensureDatabaseExists(poolConfig);
  }

  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log(`[Database] ✅ MySQL connected successfully via pool to \`${poolConfig.database}\` [${poolConfig.user}@${poolConfig.host}:${poolConfig.port}].`);
      isDbConnected = true;
      lastDbError = null;
      connection.release();
      return;
    } catch (error) {
      isDbConnected = false;
      lastDbError = error;
      console.error(`[Database] Connection attempt ${i + 1}/${retries} failed: ${error.message}`);

      // If database not found error, try to create it once before next retry
      if (error.code === 'ER_BAD_DB_ERROR' || error.message.includes('Unknown database')) {
        console.log(`[Database] Attempting to auto-create missing database \`${poolConfig.database}\`...`);
        await ensureDatabaseExists(poolConfig);
      }

      if (i < retries - 1) {
        console.log(`[Database] Retrying connection in ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  console.warn('[Database] ⚠️ Initial connection attempt failed. Server running; app will attempt connection on incoming requests.');
};

module.exports = {
  pool,
  connectDB,
  getDbConfig: resolveDbConfig,
  getDatabaseStatus,
  ensureDatabaseExists,
};
