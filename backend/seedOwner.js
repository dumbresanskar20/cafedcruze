const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Locate .env path relative to __dirname
let envPath = path.resolve(__dirname, '.env'); // local dev (backend/.env)

// Check if cPanel deployment structure is active (backend/.env is inside backend/ subfolder)
const cpanelEnvPath = path.resolve(__dirname, 'backend/.env');
if (fs.existsSync(cpanelEnvPath)) {
  envPath = cpanelEnvPath;
}

dotenv.config({ path: envPath });

const bcrypt = require('bcryptjs');
const { pool } = require('./src/database/db');

async function main() {
  // Read parameters from env or fallback to defaults
  const username = process.env.OWNER_USERNAME || 'owner';
  const email = process.env.OWNER_EMAIL || 'owner@mess.com';
  const password = process.env.OWNER_PASS || 'owner123';

  console.log(`Checking if owner account '${username}' or '${email}' already exists...`);

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  const [emailRows] = await pool.execute('SELECT * FROM AdminUser WHERE email = ? LIMIT 1', [cleanEmail]);
  const existingEmail = emailRows[0] || null;

  const [usernameRows] = await pool.execute('SELECT * FROM AdminUser WHERE username = ? LIMIT 1', [cleanUsername]);
  const existingUsername = usernameRows[0] || null;

  if (existingEmail || existingUsername) {
    console.log('Owner account already exists or email/username is in use by another admin.');
    
    // If it exists, let's update it to ensure it is role: 'owner', is_active: true, is_verified: true
    const target = existingEmail || existingUsername;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await pool.execute(
      `UPDATE AdminUser 
       SET role = 'owner', is_verified = 1, is_active = 1, password_hash = ? 
       WHERE id = ?`,
      [hashedPassword, target.id]
    );
    console.log(`Updated existing account ID ${target.id} to be Owner role with password '${password}'.`);
    return;
  }

  console.log('Creating owner account...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const [result] = await pool.execute(
    `INSERT INTO AdminUser (username, email, password_hash, role, is_active, is_verified) 
     VALUES (?, ?, ?, 'owner', 1, 1)`,
    [cleanUsername, cleanEmail, hashedPassword]
  );

  console.log('\n========================================');
  console.log('🎉 Developer OWNER account seeded successfully!');
  console.log(`Username: ${cleanUsername}`);
  console.log(`Email:    ${cleanEmail}`);
  console.log(`Password: ${password}`);
  console.log('========================================\n');
}

main()
  .catch((err) => console.error('Error seeding owner:', err))
  .finally(() => pool.end()); // Close connection pool on finish
