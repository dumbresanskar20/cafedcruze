const { pool } = require('./db');

/**
 * Ensures that `DiscountSettings`, `DiscountAuditLog`, and `MealDiscountRule` tables exist in MySQL,
 * adds any missing columns (e.g. Snacks and Dinner early-order discount columns),
 * and ensures that default records exist.
 * Runs automatically on startup.
 */
const initDiscountSchema = async () => {
  try {
    // 1. Create DiscountSettings table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`DiscountSettings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`new_user_discount_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`new_user_discount_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        \`new_user_discount_days\` INT NOT NULL DEFAULT 5,
        \`breakfast_early_discount_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`breakfast_early_discount_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        \`breakfast_early_discount_cutoff_time\` VARCHAR(10) NOT NULL DEFAULT '09:00',
        \`lunch_early_discount_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`lunch_early_discount_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        \`lunch_early_discount_cutoff_time\` VARCHAR(10) NOT NULL DEFAULT '12:00',
        \`snacks_early_discount_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`snacks_early_discount_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        \`snacks_early_discount_cutoff_time\` VARCHAR(10) NOT NULL DEFAULT '17:00',
        \`dinner_early_discount_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`dinner_early_discount_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        \`dinner_early_discount_cutoff_time\` VARCHAR(10) NOT NULL DEFAULT '20:30',
        \`updated_by\` INT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`updated_by\`) REFERENCES \`AdminUser\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Self-healing migration: Add missing columns if table already existed without snacks/dinner
    const requiredColumns = [
      { name: 'snacks_early_discount_enabled', def: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'snacks_early_discount_percentage', def: 'DECIMAL(5, 2) NOT NULL DEFAULT 10.00' },
      { name: 'snacks_early_discount_cutoff_time', def: "VARCHAR(10) NOT NULL DEFAULT '17:00'" },
      { name: 'dinner_early_discount_enabled', def: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'dinner_early_discount_percentage', def: 'DECIMAL(5, 2) NOT NULL DEFAULT 10.00' },
      { name: 'dinner_early_discount_cutoff_time', def: "VARCHAR(10) NOT NULL DEFAULT '20:30'" },
    ];

    for (const col of requiredColumns) {
      try {
        const [existing] = await pool.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'DiscountSettings' AND COLUMN_NAME = ? LIMIT 1`,
          [col.name]
        );
        if (existing.length === 0) {
          await pool.query(`ALTER TABLE \`DiscountSettings\` ADD COLUMN \`${col.name}\` ${col.def}`);
          console.log(`✅ [Database] Added missing column '${col.name}' to DiscountSettings.`);
        }
      } catch (colErr) {
        console.warn(`⚠️ [Database] Column migration check warning for '${col.name}':`, colErr.message);
      }
    }

    // 3. Ensure default record exists (id = 1)
    const [existing] = await pool.query('SELECT id FROM `DiscountSettings` WHERE id = 1 LIMIT 1');
    if (existing.length === 0) {
      console.log('[Database] Seeding initial DiscountSettings default row...');
      await pool.query(`
        INSERT INTO \`DiscountSettings\` (
          id,
          new_user_discount_enabled,
          new_user_discount_percentage,
          new_user_discount_days,
          breakfast_early_discount_enabled,
          breakfast_early_discount_percentage,
          breakfast_early_discount_cutoff_time,
          lunch_early_discount_enabled,
          lunch_early_discount_percentage,
          lunch_early_discount_cutoff_time,
          snacks_early_discount_enabled,
          snacks_early_discount_percentage,
          snacks_early_discount_cutoff_time,
          dinner_early_discount_enabled,
          dinner_early_discount_percentage,
          dinner_early_discount_cutoff_time
        ) VALUES (
          1,
          1,
          10.00,
          5,
          1,
          10.00,
          '09:00',
          1,
          10.00,
          '12:00',
          1,
          10.00,
          '17:00',
          1,
          10.00,
          '20:30'
        )
      `);
      console.log('✅ [Database] Initial DiscountSettings seeded.');
    } else {
      // If row 1 already existed, backfill any NULLs for newly added columns
      await pool.query(`
        UPDATE \`DiscountSettings\`
        SET snacks_early_discount_enabled = COALESCE(snacks_early_discount_enabled, 1),
            snacks_early_discount_percentage = COALESCE(snacks_early_discount_percentage, 10.00),
            snacks_early_discount_cutoff_time = COALESCE(snacks_early_discount_cutoff_time, '17:00'),
            dinner_early_discount_enabled = COALESCE(dinner_early_discount_enabled, 1),
            dinner_early_discount_percentage = COALESCE(dinner_early_discount_percentage, 10.00),
            dinner_early_discount_cutoff_time = COALESCE(dinner_early_discount_cutoff_time, '20:30')
        WHERE id = 1
      `);
    }

    // 4. Create DiscountAuditLog table for auditing discount modifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`DiscountAuditLog\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`admin_user_id\` INT NULL,
        \`action\` VARCHAR(50) NOT NULL DEFAULT 'update_settings',
        \`changed_fields\` TEXT NOT NULL,
        \`previous_values\` TEXT NOT NULL,
        \`new_values\` TEXT NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`admin_user_id\`) REFERENCES \`AdminUser\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Create MealDiscountRule table for dynamic per-meal discount rules
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`MealDiscountRule\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`meal_type\` VARCHAR(50) NOT NULL UNIQUE,
        \`display_name\` VARCHAR(100) NOT NULL,
        \`discount_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        \`cutoff_time\` VARCHAR(10) NOT NULL DEFAULT '12:00',
        \`is_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure default core meal types exist in MealDiscountRule
    const defaultRules = [
      ['breakfast', 'Early Breakfast Discount', 10.00, '09:00', 1],
      ['lunch',     'Early Lunch Discount',     10.00, '12:00', 1],
      ['snacks',    'Early Snacks Discount',    10.00, '17:00', 1],
      ['dinner',    'Early Dinner Discount',    10.00, '20:30', 1],
    ];

    for (const [meal_type, display_name, pct, cutoff, enabled] of defaultRules) {
      await pool.execute(
        `INSERT INTO \`MealDiscountRule\` (meal_type, display_name, discount_percentage, cutoff_time, is_enabled)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [meal_type, display_name, pct, cutoff, enabled]
      );
    }

    // Auto-sync any existing custom meal types from MealWindow into MealDiscountRule
    try {
      const [customWindows] = await pool.query('SELECT meal_type, end_time FROM `MealWindow`');
      if (customWindows && customWindows.length > 0) {
        for (const win of customWindows) {
          const type = (win.meal_type || '').toLowerCase().trim();
          if (!type) continue;
          const [exists] = await pool.execute(
            'SELECT id FROM `MealDiscountRule` WHERE meal_type = ? LIMIT 1',
            [type]
          );
          if (exists.length === 0) {
            const prettyName = 'Early ' + type.charAt(0).toUpperCase() + type.slice(1) + ' Discount';
            await pool.execute(
              `INSERT INTO \`MealDiscountRule\` (meal_type, display_name, discount_percentage, cutoff_time, is_enabled)
               VALUES (?, ?, ?, ?, ?)`,
              [type, prettyName, 10.00, win.end_time || '18:00', 1]
            );
            console.log(`✅ [Database] Auto-registered discount rule for meal type: ${type}`);
          }
        }
      }
    } catch (syncErr) {
      console.warn('[Database] MealWindow sync warning:', syncErr.message);
    }

    console.log('✅ [Database] Discount schema and dynamic meal rules initialized successfully.');
  } catch (error) {
    console.error('⚠️ [Database] Failed to initialize discount schema:', error.message);
  }
};

module.exports = { initDiscountSchema };
