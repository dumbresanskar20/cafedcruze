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
const { initInventorySchema } = require('./src/database/initInventorySchema');
const { initOrderSchema } = require('./src/database/initOrderSchema');

async function main() {
  console.log('Running database schema updates...');
  
  // Alter role column ENUM to support 'admin'
  try {
    await pool.execute(
      `ALTER TABLE AdminUser MODIFY COLUMN role ENUM('owner', 'super_admin', 'admin', 'staff') NOT NULL DEFAULT 'staff'`
    );
    console.log('🎉 Successfully modified AdminUser.role ENUM in MySQL database to support [owner, super_admin, admin, staff].');
  } catch (err) {
    console.warn('Note on AdminUser.role:', err.message);
  }

  // Initialize and verify inventory tables
  await initInventorySchema();
  console.log('🎉 Successfully verified and created inventory tables (InventoryItem, RecipeItem, InventoryLog, InventoryCounter).');

  // Initialize and verify order tables & columns
  await initOrderSchema();
  console.log('🎉 Successfully verified and updated Order schema columns (payment_status, order_status, date, etc.).');
}

main()
  .catch((err) => console.error('Error updating DB schema:', err))
  .finally(() => pool.end());
