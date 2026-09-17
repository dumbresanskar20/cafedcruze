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

const bcrypt = require('bcryptjs');
const { pool } = require('./src/database/db');

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASS;

  if (!username || !email || !password) {
    console.error('Error: Initial admin credentials (ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASS) are not fully configured in the environment.');
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  console.log(`Checking if admin account '${cleanUsername}' or '${cleanEmail}' exists in the database...`);

  // Query database for existing entries
  const [rows] = await pool.execute(
    'SELECT * FROM AdminUser WHERE email = ? OR username = ? LIMIT 1', 
    [cleanEmail, cleanUsername]
  );
  const admin = rows[0] || null;

  if (!admin) {
    console.error(`Error: Admin account with username '${cleanUsername}' or email '${cleanEmail}' was not found in the database.`);
    process.exit(1);
  }

  if (admin.role === 'owner') {
    console.error('Error: The matched account is an OWNER. This script will not modify owner accounts.');
    process.exit(1);
  }

  console.log(`Found admin account ID: ${admin.id}. Resetting password and updating status...`);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Update password_hash, is_active, is_verified, and set role to 'super_admin' (the database-expected role)
  await pool.execute(
    `UPDATE AdminUser 
     SET password_hash = ?, role = 'super_admin', is_active = 1, is_verified = 1 
     WHERE id = ?`,
    [hashedPassword, admin.id]
  );

  console.log('\n========================================');
  console.log('🎉 Admin password reset and status updated successfully!');
  console.log(`Username:  ${admin.username}`);
  console.log(`Email:     ${admin.email}`);
  console.log(`Role:      super_admin`);
  console.log(`Status:    Active & Verified`);
  console.log('========================================\n');
}

main()
  .catch((err) => console.error('Error resetting admin password:', err))
  .finally(() => pool.end());
