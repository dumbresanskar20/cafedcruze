const { pool } = require('./db');

/**
 * Ensures MenuItem and OrderItem tables have variant columns for Chapati / portion pricing:
 * - MenuItem.has_variants (TINYINT(1) DEFAULT 0)
 * - MenuItem.variants (JSON / TEXT NULL)
 * - OrderItem.variant_name (VARCHAR(100) NULL)
 */
const initMenuSchema = async () => {
  try {
    // 1. Check MenuItem columns
    const [menuCols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'MenuItem'
    `);

    if (menuCols && menuCols.length > 0) {
      const colNames = new Set(menuCols.map((c) => c.COLUMN_NAME.toLowerCase()));

      if (!colNames.has('has_variants')) {
        console.log('[Database] Adding `has_variants` column to `MenuItem` table...');
        await pool.query('ALTER TABLE `MenuItem` ADD COLUMN `has_variants` TINYINT(1) NOT NULL DEFAULT 0 AFTER `description`');
        console.log('✅ [Database] `MenuItem.has_variants` added.');
      }

      if (!colNames.has('variants')) {
        console.log('[Database] Adding `variants` column to `MenuItem` table...');
        try {
          await pool.query('ALTER TABLE `MenuItem` ADD COLUMN `variants` JSON NULL AFTER `has_variants`');
        } catch (jsonErr) {
          // Fallback to TEXT for older MySQL/MariaDB versions that do not support native JSON
          await pool.query('ALTER TABLE `MenuItem` ADD COLUMN `variants` TEXT NULL AFTER `has_variants`');
        }
        console.log('✅ [Database] `MenuItem.variants` added.');
      }
    }

    // 2. Check OrderItem columns
    const [orderItemCols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'OrderItem'
    `);

    if (orderItemCols && orderItemCols.length > 0) {
      const colNames = new Set(orderItemCols.map((c) => c.COLUMN_NAME.toLowerCase()));

      if (!colNames.has('variant_name')) {
        console.log('[Database] Adding `variant_name` column to `OrderItem` table...');
        await pool.query('ALTER TABLE `OrderItem` ADD COLUMN `variant_name` VARCHAR(100) NULL AFTER `quantity`');
        console.log('✅ [Database] `OrderItem.variant_name` added.');
      }
    }

    console.log('✅ [Database] Menu variants schema verified successfully.');
  } catch (err) {
    console.warn('⚠️ [Database] initMenuSchema warning:', err.message);
  }
};

module.exports = { initMenuSchema };
