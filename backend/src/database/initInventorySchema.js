const { pool } = require('./db');

/**
 * Ensures all Inventory-related tables and counters exist in the database.
 * Runs automatically on backend startup to ensure compatibility with
 * cPanel MySQL, local dev, and fresh production deployments.
 */
const initInventorySchema = async () => {
  try {
    // 1. Create InventoryItem table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryItem\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`unique_inventory_id\` VARCHAR(100) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`unit\` ENUM('kg', 'g', 'litre', 'ml', 'piece', 'packet') NOT NULL,
        \`quantity_in_stock\` DECIMAL(10, 3) NOT NULL,
        \`low_stock_threshold\` DECIMAL(10, 3) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'other',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Create RecipeItem table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`RecipeItem\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`menu_item_id\` INT NOT NULL,
        \`inventory_item_id\` INT NOT NULL,
        \`quantity_required\` DECIMAL(10, 3) NOT NULL,
        \`quantity_unit\` ENUM('kg', 'g', 'litre', 'ml', 'piece', 'packet') NOT NULL DEFAULT 'kg',
        UNIQUE KEY \`menu_item_inventory_item\` (\`menu_item_id\`, \`inventory_item_id\`),
        FOREIGN KEY (\`menu_item_id\`) REFERENCES \`MenuItem\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`inventory_item_id\`) REFERENCES \`InventoryItem\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Create InventoryLog table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryLog\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`inventory_item_id\` INT NOT NULL,
        \`action_type\` VARCHAR(100) NOT NULL,
        \`quantity_changed\` DECIMAL(10, 3) NOT NULL,
        \`admin_user_id\` INT NULL,
        \`order_id\` INT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`inventory_item_id\`) REFERENCES \`InventoryItem\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`admin_user_id\`) REFERENCES \`AdminUser\`(\`id\`) ON DELETE SET NULL,
        FOREIGN KEY (\`order_id\`) REFERENCES \`Order\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Create InventoryCounter table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryCounter\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`last_value\` INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Initialize InventoryCounter row if not present
    await pool.query(`
      INSERT INTO \`InventoryCounter\` (\`id\`, \`last_value\`)
      VALUES (1, 0)
      ON DUPLICATE KEY UPDATE id=id;
    `);

    // 6. Synchronize InventoryCounter.last_value with maximum existing INV-XXXX id
    const [maxRows] = await pool.query(`
      SELECT MAX(CAST(SUBSTRING(unique_inventory_id, 5) AS UNSIGNED)) AS max_inv_num 
      FROM \`InventoryItem\` 
      WHERE unique_inventory_id LIKE 'INV-%'
    `);
    const maxNum = maxRows[0]?.max_inv_num || 0;
    if (maxNum > 0) {
      await pool.query(`
        UPDATE \`InventoryCounter\` 
        SET \`last_value\` = GREATEST(\`last_value\`, ?) 
        WHERE id = 1
      `, [maxNum]);
    }

    // 7. Ensure MenuItem has available_quantity, daily_stock_limit, and is_available
    const [menuItemCols] = await pool.query(`SHOW COLUMNS FROM \`MenuItem\` LIKE 'available_quantity'`);
    if (menuItemCols.length === 0) {
      await pool.query(`ALTER TABLE \`MenuItem\` ADD COLUMN \`available_quantity\` INT NOT NULL DEFAULT 100`);
      console.log('✅ [Database] Added available_quantity column to MenuItem.');
    }

    const [dailyStockCols] = await pool.query(`SHOW COLUMNS FROM \`MenuItem\` LIKE 'daily_stock_limit'`);
    if (dailyStockCols.length === 0) {
      await pool.query(`ALTER TABLE \`MenuItem\` ADD COLUMN \`daily_stock_limit\` INT NOT NULL DEFAULT 100`);
      console.log('✅ [Database] Added daily_stock_limit column to MenuItem.');
    }

    const [availCols] = await pool.query(`SHOW COLUMNS FROM \`MenuItem\` LIKE 'is_available'`);
    if (availCols.length === 0) {
      await pool.query(`ALTER TABLE \`MenuItem\` ADD COLUMN \`is_available\` TINYINT(1) NOT NULL DEFAULT 1`);
      console.log('✅ [Database] Added is_available column to MenuItem.');
    }

    // 8. Create InventoryConfig table for global settings (e.g. menu_stock_tracking_enabled)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`InventoryConfig\` (
        \`key_name\` VARCHAR(100) PRIMARY KEY,
        \`value_str\` VARCHAR(255) NOT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      INSERT INTO \`InventoryConfig\` (\`key_name\`, \`value_str\`)
      VALUES ('menu_stock_tracking_enabled', 'false')
      ON DUPLICATE KEY UPDATE key_name = key_name;
    `);

    console.log('✅ [Database] Inventory tables, MenuItem stock columns & config verified successfully.');
  } catch (error) {
    console.error('⚠️ [Database] Failed to verify inventory tables:', error.message);
  }
};

module.exports = { initInventorySchema };
