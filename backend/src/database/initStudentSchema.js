const { pool } = require('./db');

/**
 * Ensures that Student table has the `phone` column.
 * Runs automatically on startup.
 */
const initStudentSchema = async () => {
  try {
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Student' 
        AND COLUMN_NAME = 'phone'
    `);

    if (columns.length === 0) {
      console.log('[Database] Adding `phone` column to `Student` table...');
      await pool.query(`
        ALTER TABLE \`Student\` 
        ADD COLUMN \`phone\` VARCHAR(20) NULL UNIQUE AFTER \`email\`
      `);
      console.log('✅ [Database] `Student.phone` column added successfully.');
    }

    // Ensure roll_no and password_hash allow NULL for Google OAuth students
    try {
      await pool.query('ALTER TABLE `Student` MODIFY COLUMN `roll_no` VARCHAR(255) NULL');
    } catch (err) {
      // Ignored if already null or in strict mode
    }

    try {
      await pool.query('ALTER TABLE `Student` MODIFY COLUMN `password_hash` VARCHAR(255) NULL');
    } catch (err) {
      // Ignored
    }

    // Add avatar_url column if not present
    try {
      const [avatarCol] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'Student' 
          AND COLUMN_NAME = 'avatar_url'
      `);
      if (avatarCol.length === 0) {
        await pool.query('ALTER TABLE `Student` ADD COLUMN `avatar_url` VARCHAR(500) NULL AFTER `roll_no`');
      }
    } catch (err) {
      // Ignored
    }

    // Add google_id column if not present
    try {
      const [googleCol] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'Student' 
          AND COLUMN_NAME = 'google_id'
      `);
      if (googleCol.length === 0) {
        await pool.query('ALTER TABLE `Student` ADD COLUMN `google_id` VARCHAR(255) NULL AFTER `avatar_url`');
      }
    } catch (err) {
      // Ignored
    }

    // Ensure MenuItemReview table exists for meal ratings and reviews
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`MenuItemReview\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`order_id\` INT NOT NULL,
          \`student_id\` INT NOT NULL,
          \`menu_item_id\` INT NULL,
          \`menu_item_name\` VARCHAR(255) NOT NULL DEFAULT '',
          \`meal_type\` VARCHAR(50) NOT NULL DEFAULT 'lunch',
          \`rating\` TINYINT NOT NULL DEFAULT 5,
          \`review_text\` TEXT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_review_order\` (\`order_id\`),
          INDEX \`idx_review_student\` (\`student_id\`),
          INDEX \`idx_review_menu_item\` (\`menu_item_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Ensure menu_item_id is nullable in existing installations
      await pool.query('ALTER TABLE `MenuItemReview` MODIFY COLUMN `menu_item_id` INT NULL').catch(() => {});

      console.log('✅ [Database] `MenuItemReview` table verified/ready.');
    } catch (err) {
      console.error('⚠️ [Database] MenuItemReview table check warning:', err.message);
    }
  } catch (error) {
    console.error('⚠️ [Database] Failed to verify schema columns:', error.message);
  }
};

module.exports = { initStudentSchema };
