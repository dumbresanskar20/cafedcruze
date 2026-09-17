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
  const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@canteen.com').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASS || 'SuperAdmin@123';
  const name = process.env.SUPERADMIN_NAME || 'Master Super Admin';

  console.log(`[SuperAdmin Seed] Ensuring SuperAdmin table exists...`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`SuperAdmin\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`email\` VARCHAR(255) NOT NULL UNIQUE,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`role\` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`last_login_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log(`[SuperAdmin Seed] Checking if '${email}' exists in SuperAdmin table...`);
  const [rows] = await pool.execute('SELECT id FROM `SuperAdmin` WHERE email = ? LIMIT 1', [email]);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  if (rows.length > 0) {
    const existing = rows[0];
    await pool.execute(
      'UPDATE `SuperAdmin` SET password_hash = ?, is_active = 1, role = \'super_admin\' WHERE id = ?',
      [hashedPassword, existing.id]
    );
    console.log('\n========================================================');
    console.log('✅ Super-Admin account password successfully reset & verified!');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('Role:     super_admin');
    console.log('========================================================\n');
  } else {
    await pool.execute(
      'INSERT INTO `SuperAdmin` (name, email, password_hash, role, is_active) VALUES (?, ?, ?, \'super_admin\', 1)',
      [name, email, hashedPassword]
    );
    console.log('\n========================================================');
    console.log('🎉 Super-Admin account created successfully!');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('Role:     super_admin');
    console.log('========================================================\n');
  }
}

main()
  .catch((err) => console.error('❌ Error seeding SuperAdmin:', err))
  .finally(() => pool.end());
