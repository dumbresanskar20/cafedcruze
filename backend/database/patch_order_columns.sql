-- ========================================================================
-- MealBook / Mess Management - Quick Fix for Order Table Columns
-- Run this SQL in phpMyAdmin or MySQL CLI to fix the 500 Internal Server Error
-- ========================================================================

-- 1. Ensure columns exist on `Order` table
ALTER TABLE `Order` ADD COLUMN `payment_status` VARCHAR(50) NOT NULL DEFAULT 'paid';
ALTER TABLE `Order` ADD COLUMN `order_status` VARCHAR(50) NOT NULL DEFAULT 'placed';
ALTER TABLE `Order` ADD COLUMN `date` VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE `Order` ADD COLUMN `daily_sequence` INT NOT NULL DEFAULT 1;
ALTER TABLE `Order` ADD COLUMN `order_type` VARCHAR(20) NOT NULL DEFAULT 'dine_in';
ALTER TABLE `Order` ADD COLUMN `is_parcel` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `Order` ADD COLUMN `razorpay_signature` VARCHAR(255) NULL;
ALTER TABLE `Order` ADD COLUMN `customer_name` VARCHAR(255) NULL;
ALTER TABLE `Order` ADD COLUMN `subtotal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `Order` ADD COLUMN `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `Order` ADD COLUMN `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `Order` ADD COLUMN `discount_type` VARCHAR(50) NOT NULL DEFAULT 'none';

-- 2. Modify existing columns for nullability and types
ALTER TABLE `Order` MODIFY COLUMN `student_id` INT NULL;
ALTER TABLE `Order` MODIFY COLUMN `expires_at` DATETIME NULL;
ALTER TABLE `Order` MODIFY COLUMN `token_number` VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE `Order` MODIFY COLUMN `formatted_token` VARCHAR(50) NULL DEFAULT '';
ALTER TABLE `Order` MODIFY COLUMN `payment_method` VARCHAR(50) NOT NULL DEFAULT 'cash';
ALTER TABLE `Order` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL;

-- 3. Backfill missing values for existing rows
UPDATE `Order` SET `date` = DATE_FORMAT(`created_at`, '%Y-%m-%d') WHERE `date` = '' OR `date` IS NULL;
UPDATE `Order` SET `payment_status` = 'paid' WHERE `payment_status` = '' OR `payment_status` IS NULL;
UPDATE `Order` SET `order_status` = 'placed' WHERE `order_status` = '' OR `order_status` IS NULL;

-- 4. Helpful index for date & payment status lookups
ALTER TABLE `Order` ADD INDEX `idx_order_date_paid` (`date`, `payment_status`);
