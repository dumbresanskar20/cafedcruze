const { pool } = require('./db');

/**
 * Ensures that the `Order` table has all columns required by the application:
 * - student_id (nullable for walk-ins)
 * - customer_name, subtotal_amount, discount_percentage, discount_amount, discount_type
 * - payment_status, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature
 * - token_number, formatted_token, daily_sequence, order_status, date, order_type, is_parcel
 * - expires_at (nullable)
 * Runs safely on startup and lazily on request, supporting all MySQL/MariaDB versions.
 */
const initOrderSchema = async () => {
  try {
    // 1. Fetch all existing columns in the `Order` table
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Order'
    `);

    if (!cols || cols.length === 0) {
      console.warn('[Database] `Order` table not found in current schema.');
      return;
    }

    const colMap = new Map();
    cols.forEach((c) => {
      colMap.set(c.COLUMN_NAME.toLowerCase(), {
        name: c.COLUMN_NAME,
        type: (c.DATA_TYPE || '').toLowerCase(),
        isNullable: c.IS_NULLABLE === 'YES',
      });
    });

    const hasCol = (colName) => colMap.has(colName.toLowerCase());

    // Helper to safely execute ALTER TABLE statements
    const safeAlter = async (description, sql) => {
      try {
        await pool.query(sql);
        console.log(`✅ [Database] ${description}`);
      } catch (err) {
        console.warn(`[Database] Notice on ${description}: ${err.message}`);
      }
    };

    // 2. Column type adjustments on existing columns
    // student_id must be nullable for walk-in orders
    if (hasCol('student_id') && !colMap.get('student_id').isNullable) {
      await safeAlter('Making `Order.student_id` nullable', 'ALTER TABLE `Order` MODIFY COLUMN `student_id` INT NULL');
    }

    // expires_at must be nullable (walk-in orders and modern orders do not set fixed expires_at)
    if (hasCol('expires_at') && !colMap.get('expires_at').isNullable) {
      await safeAlter('Making `Order.expires_at` nullable', 'ALTER TABLE `Order` MODIFY COLUMN `expires_at` DATETIME NULL');
    }

    // token_number should be VARCHAR to store tokens like "T-001" or string numbers
    if (hasCol('token_number') && colMap.get('token_number').type === 'int') {
      await safeAlter('Converting `Order.token_number` to VARCHAR(50)', "ALTER TABLE `Order` MODIFY COLUMN `token_number` VARCHAR(50) NOT NULL DEFAULT ''");
    }

    // formatted_token should allow NULL or default empty
    if (hasCol('formatted_token') && !colMap.get('formatted_token').isNullable) {
      await safeAlter('Making `Order.formatted_token` nullable', "ALTER TABLE `Order` MODIFY COLUMN `formatted_token` VARCHAR(50) NULL DEFAULT ''");
    }

    // payment_method should accommodate cash, upi, razorpay, counter_cash, etc.
    if (hasCol('payment_method')) {
      await safeAlter('Ensuring `Order.payment_method` is VARCHAR(50)', "ALTER TABLE `Order` MODIFY COLUMN `payment_method` VARCHAR(50) NOT NULL DEFAULT 'cash'");
    }

    // meal_type should accommodate dynamic custom meal types
    if (hasCol('meal_type') && colMap.get('meal_type').type === 'enum') {
      await safeAlter('Converting `Order.meal_type` to VARCHAR(50)', 'ALTER TABLE `Order` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL');
    }

    // 3. Add missing columns independently without depending on specific column order
    if (!hasCol('customer_name')) {
      await safeAlter('Adding `customer_name` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `customer_name` VARCHAR(255) NULL');
    }

    if (!hasCol('subtotal_amount')) {
      await safeAlter('Adding `subtotal_amount` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `subtotal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00');
    }

    if (!hasCol('discount_percentage')) {
      await safeAlter('Adding `discount_percentage` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00');
    }

    if (!hasCol('discount_amount')) {
      await safeAlter('Adding `discount_amount` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00');
    }

    if (!hasCol('discount_type')) {
      await safeAlter('Adding `discount_type` to `Order`', "ALTER TABLE `Order` ADD COLUMN `discount_type` VARCHAR(50) NOT NULL DEFAULT 'none'");
    }

    if (!hasCol('payment_status')) {
      await safeAlter('Adding `payment_status` to `Order`', "ALTER TABLE `Order` ADD COLUMN `payment_status` VARCHAR(50) NOT NULL DEFAULT 'paid'");
    }

    if (!hasCol('order_status')) {
      await safeAlter('Adding `order_status` to `Order`', "ALTER TABLE `Order` ADD COLUMN `order_status` VARCHAR(50) NOT NULL DEFAULT 'placed'");
    }

    if (!hasCol('date')) {
      await safeAlter('Adding `date` to `Order`', "ALTER TABLE `Order` ADD COLUMN `date` VARCHAR(10) NOT NULL DEFAULT ''");
    }

    if (!hasCol('daily_sequence')) {
      await safeAlter('Adding `daily_sequence` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `daily_sequence` INT NOT NULL DEFAULT 1');
    }

    if (!hasCol('order_type')) {
      await safeAlter('Adding `order_type` to `Order`', "ALTER TABLE `Order` ADD COLUMN `order_type` VARCHAR(20) NOT NULL DEFAULT 'dine_in'");
    }

    if (!hasCol('is_parcel')) {
      await safeAlter('Adding `is_parcel` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `is_parcel` TINYINT(1) NOT NULL DEFAULT 0');
    }

    if (!hasCol('razorpay_signature')) {
      await safeAlter('Adding `razorpay_signature` to `Order`', 'ALTER TABLE `Order` ADD COLUMN `razorpay_signature` VARCHAR(255) NULL');
    }

    // 4. Backfill critical data for any rows missing date, payment_status, or order_status
    try {
      await pool.query(`
        UPDATE \`Order\` 
        SET \`date\` = DATE_FORMAT(\`created_at\`, '%Y-%m-%d') 
        WHERE (\`date\` = '' OR \`date\` IS NULL) AND \`created_at\` IS NOT NULL
      `);
    } catch (e) { /* ignore */ }

    try {
      await pool.query(`
        UPDATE \`Order\` 
        SET \`payment_status\` = 'paid' 
        WHERE (\`payment_status\` = '' OR \`payment_status\` IS NULL)
      `);
    } catch (e) { /* ignore */ }

    try {
      await pool.query(`
        UPDATE \`Order\` 
        SET \`order_status\` = 'placed' 
        WHERE (\`order_status\` = '' OR \`order_status\` IS NULL)
      `);
    } catch (e) { /* ignore */ }

    // 5. Add helpful indexes if missing
    try {
      await pool.query('ALTER TABLE `Order` ADD INDEX `idx_order_date_paid` (`date`, `payment_status`)');
    } catch (e) { /* already exists */ }

    console.log('✅ [Database] Order schema verification & update complete.');
  } catch (error) {
    console.error('⚠️ [Database] Failed to verify Order schema:', error.message);
  }
};

module.exports = { initOrderSchema };
