const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Locate .env path relative to __dirname
let envPath = path.resolve(__dirname, '.env');

const cpanelEnvPath = path.resolve(__dirname, 'backend/.env');
if (fs.existsSync(cpanelEnvPath)) {
  envPath = cpanelEnvPath;
}

dotenv.config({ path: envPath });

const { pool } = require('./src/database/db');

async function main() {
  console.log('Querying AdminUser table contents...');
  const [rows] = await pool.execute(
    'SELECT id, username, email, role, is_active, is_verified, created_at, last_login_at FROM AdminUser'
  );
  
  console.log('\n========================================================================');
  console.log('👤 Existing Admin Users:');
  console.table(rows);
  console.log('========================================================================\n');
}

main()
  .catch((err) => console.error('Error inspecting DB:', err))
  .finally(() => pool.end());
