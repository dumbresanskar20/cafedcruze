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
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASS;

  // Validate presence of required environment variables
  if (!username || !email || !password) {
    console.error('Error: Initial admin credentials are not fully configured in the environment.');
    console.error('Please configure ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASS in your environment.');
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  console.log(`Checking if admin account '${cleanUsername}' or '${cleanEmail}' already exists...`);

  // Query database for existing entries
  const [emailRows] = await pool.execute('SELECT * FROM AdminUser WHERE email = ? LIMIT 1', [cleanEmail]);
  const existingEmail = emailRows[0] || null;

  const [usernameRows] = await pool.execute('SELECT * FROM AdminUser WHERE username = ? LIMIT 1', [cleanUsername]);
  const existingUsername = usernameRows[0] || null;

  // Handle case where username or email already exists
  if (existingEmail || existingUsername) {
    const target = existingEmail || existingUsername;
    
    // Check if the conflicting account is our normal admin
    if (target.role === 'admin' && target.email.toLowerCase() === cleanEmail && target.username.toLowerCase() === cleanUsername) {
      console.log(`Admin account '${cleanUsername}' (${cleanEmail}) already exists. No action required.`);
    } else {
      console.log('Conflict: An account with this username or email already exists in the database.');
      console.log(`Conflicting Account ID: ${target.id}, Role: ${target.role}. No modifications were made.`);
    }
    return;
  }

  console.log('Creating normal admin account...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Insert admin user
  await pool.execute(
    `INSERT INTO AdminUser (username, email, password_hash, role, is_active, is_verified) 
     VALUES (?, ?, ?, 'admin', 1, 1)`,
    [cleanUsername, cleanEmail, hashedPassword]
  );

  console.log('\n========================================');
  console.log('🎉 Normal Administrator account seeded successfully!');
  console.log(`Username: ${cleanUsername}`);
  console.log(`Email:    ${cleanEmail}`);
  console.log('Role:     admin');
  console.log('========================================\n');
}

main()
  .catch((err) => console.error('Error seeding admin:', err))
  .finally(() => pool.end());
