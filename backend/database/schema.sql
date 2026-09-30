-- Mess Management System MySQL Schema
-- Suitable for phpMyAdmin, MySQL command line, or cPanel imports

SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- Table: Student
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Student` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL UNIQUE,
  `roll_no` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `otp_code` VARCHAR(10) NULL,
  `otp_expires_at` DATETIME NULL,
  `failed_login_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `reset_token` VARCHAR(255) NULL,
  `reset_token_expires` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: AdminUser
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `AdminUser` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'admin', 'staff') NOT NULL DEFAULT 'staff',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `verification_token` VARCHAR(255) NULL,
  `created_by_id` INT NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: MenuItem
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `MenuItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL DEFAULT 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
  `cloudinary_public_id` VARCHAR(255) NULL,
  `meal_type` VARCHAR(50) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `description` TEXT NULL,
  `has_variants` TINYINT(1) NOT NULL DEFAULT 0,
  `variants` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_meal_active` (`meal_type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: MealWindow
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `MealWindow`;
CREATE TABLE `MealWindow` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meal_type` VARCHAR(50) NOT NULL UNIQUE,
  `start_time` VARCHAR(10) NOT NULL, -- HH:mm (24h)
  `end_time` VARCHAR(10) NOT NULL,   -- HH:mm (24h)
  `serving_start_time` VARCHAR(10) NULL, -- HH:mm (24h) meal distribution start time shown on notice
  `custom_note` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_full_day` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: Order
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Order` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NULL,
  `customer_name` VARCHAR(255) NULL,
  `token_number` VARCHAR(50) NOT NULL DEFAULT '',
  `formatted_token` VARCHAR(50) NULL DEFAULT '',
  `meal_type` VARCHAR(50) NOT NULL DEFAULT 'breakfast',
  `status` VARCHAR(50) NOT NULL DEFAULT 'booked',
  `order_status` VARCHAR(50) NOT NULL DEFAULT 'placed',
  `order_type` VARCHAR(20) NOT NULL DEFAULT 'dine_in',
  `is_parcel` TINYINT(1) NOT NULL DEFAULT 0,
  `date` VARCHAR(10) NOT NULL DEFAULT '',
  `daily_sequence` INT NOT NULL DEFAULT 1,
  `subtotal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_type` VARCHAR(50) NOT NULL DEFAULT 'none',
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `is_paid` TINYINT(1) NOT NULL DEFAULT 1,
  `payment_status` VARCHAR(50) NOT NULL DEFAULT 'paid',
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `razorpay_order_id` VARCHAR(255) NULL,
  `razorpay_payment_id` VARCHAR(255) NULL,
  `razorpay_signature` VARCHAR(255) NULL,
  `collected_at` DATETIME NULL,
  `collected_by_admin_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL,
  INDEX `idx_order_status_meal` (`order_status`, `meal_type`),
  INDEX `idx_order_date` (`date`),
  INDEX `idx_order_student` (`student_id`),
  FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`collected_by_admin_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: OrderItem
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `menu_item_id` INT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `quantity` INT NOT NULL,
  `variant_name` VARCHAR(100) NULL,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`menu_item_id`) REFERENCES `MenuItem`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: DailyTokenCounter
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `DailyTokenCounter` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meal_type` VARCHAR(50) NOT NULL,
  `date` VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  `last_token_number` INT NOT NULL DEFAULT 0,
  UNIQUE KEY `meal_type_date` (`meal_type`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: Subscription
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Subscription` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_type` ENUM('monthly', 'quarterly', 'six_month', 'yearly') NOT NULL DEFAULT 'monthly',
  `subscription_start_date` DATETIME NOT NULL,
  `subscription_end_date` DATETIME NOT NULL,
  `status` ENUM('active', 'expired', 'suspended') NOT NULL DEFAULT 'active',
  `last_payment_amount` DECIMAL(10, 2) NULL,
  `last_payment_date` DATETIME NULL,
  `dev_razorpay_payment_id` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: SuperAdmin (Master Multi-Tenant Authentication)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SuperAdmin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: Plan
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Plan` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `billing_cycle` ENUM('monthly', 'quarterly', 'six_month', 'yearly', 'custom') NOT NULL DEFAULT 'monthly',
  `price` DECIMAL(10, 2) NOT NULL,
  `trial_days` INT NOT NULL DEFAULT 14,
  `features` JSON NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: PlanPriceHistory
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `PlanPriceHistory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id` INT NOT NULL,
  `old_price` DECIMAL(10, 2) NOT NULL,
  `new_price` DECIMAL(10, 2) NOT NULL,
  `changed_by_id` INT NULL,
  `changed_by_name` VARCHAR(255) NULL,
  `reason` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`plan_id`) REFERENCES `Plan`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: Client (Tenant / Campus Organization)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Client` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `contact_email` VARCHAR(255) NOT NULL,
  `contact_phone` VARCHAR(20) NULL,
  `address` VARCHAR(500) NULL,
  `plan_id` INT NULL,
  `status` ENUM('active', 'trial', 'suspended', 'expired') NOT NULL DEFAULT 'trial',
  `trial_ends_at` DATETIME NULL,
  `subscription_price` DECIMAL(10, 2) NULL,
  `subscription_started_at` DATETIME NULL,
  `subscription_ends_at` DATETIME NULL,
  `suspended_at` DATETIME NULL,
  `is_admin_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `is_student_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`plan_id`) REFERENCES `Plan`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: SuperAdminAuditLog
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SuperAdminAuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `actor_id` INT NULL,
  `actor_name` VARCHAR(255) NOT NULL,
  `actor_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `client_id` INT NULL,
  `client_name` VARCHAR(255) NULL,
  `before_value` JSON NULL,
  `after_value` JSON NULL,
  `ip_address` VARCHAR(100) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: AuditLog (Admin User actions)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `module` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(100) NULL,
  `browser` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: InventoryItem
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `unique_inventory_id` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `unit` ENUM('kg', 'g', 'litre', 'ml', 'piece', 'packet') NOT NULL,
  `quantity_in_stock` DECIMAL(10, 3) NOT NULL,
  `low_stock_threshold` DECIMAL(10, 3) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'other',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: RecipeItem
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `RecipeItem` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `menu_item_id` INT NOT NULL,
  `inventory_item_id` INT NOT NULL,
  `quantity_required` DECIMAL(10, 3) NOT NULL,
  `quantity_unit` ENUM('kg', 'g', 'litre', 'ml', 'piece', 'packet') NOT NULL DEFAULT 'kg',
  UNIQUE KEY `menu_item_inventory_item` (`menu_item_id`, `inventory_item_id`),
  FOREIGN KEY (`menu_item_id`) REFERENCES `MenuItem`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`inventory_item_id`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: InventoryLog
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `inventory_item_id` INT NOT NULL,
  `action_type` VARCHAR(100) NOT NULL, -- 'restock', 'deduction'
  `quantity_changed` DECIMAL(10, 3) NOT NULL,
  `admin_user_id` INT NULL,
  `order_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`inventory_item_id`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`admin_user_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: MenuItemReview
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `MenuItemReview` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `menu_item_id` INT NOT NULL,
  `menu_item_name` VARCHAR(255) NOT NULL,
  `meal_type` VARCHAR(50) NOT NULL,
  `rating` TINYINT NOT NULL,
  `review_text` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_order_item_review` (`order_id`, `menu_item_id`),
  INDEX `idx_review_menu_item` (`menu_item_id`),
  INDEX `idx_review_order` (`order_id`),
  INDEX `idx_review_student` (`student_id`),
  FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`menu_item_id`) REFERENCES `MenuItem`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: InventoryCounter
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `InventoryCounter` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `last_value` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: MealWindow
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `MealWindow` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meal_type` VARCHAR(50) NOT NULL UNIQUE,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_full_day` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- SEED DATA: Meal Windows & Initial Inventory Counter
-- -------------------------------------------------------------
INSERT INTO `MealWindow` (`meal_type`, `start_time`, `serving_start_time`, `end_time`, `is_active`, `is_full_day`)
VALUES
  ('breakfast', '07:30', '08:30', '10:00', 1, 0),
  ('lunch',     '12:00', '12:30', '14:30', 1, 0),
  ('snacks',    '16:30', '16:30', '18:00', 1, 0),
  ('dinner',    '19:30', '19:30', '21:30', 1, 0)
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO `InventoryCounter` (`id`, `last_value`)
VALUES (1, 0)
ON DUPLICATE KEY UPDATE id=id;

-- Seed Default Canteen Admin (Username: admin, Password: AdminPassword@123)
-- bcrypt hash for 'AdminPassword@123'
INSERT INTO `AdminUser` (`username`, `email`, `password_hash`, `role`, `is_active`, `is_verified`)
VALUES ('admin', 'admin@dypcoei.edu.in', '$2a$10$w8T0U1B2jA5GZlY59/gBDe42rO1w0h/U6.hBq12Vj6B2L.m8K9f62', 'super_admin', 1, 1)
ON DUPLICATE KEY UPDATE id=id;

-- -------------------------------------------------------------
-- Table: DiscountSettings
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `DiscountSettings`;
CREATE TABLE `DiscountSettings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `new_user_discount_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `new_user_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `new_user_discount_days` INT NOT NULL DEFAULT 5,
  `breakfast_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `breakfast_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `breakfast_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '09:00',
  `lunch_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `lunch_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `lunch_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '12:00',
  `snacks_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `snacks_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `snacks_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '17:00',
  `dinner_early_discount_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `dinner_early_discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `dinner_early_discount_cutoff_time` VARCHAR(10) NOT NULL DEFAULT '20:30',
  `updated_by` INT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`updated_by`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- Table: DiscountAuditLog
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `DiscountAuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_user_id` INT NULL,
  `action` VARCHAR(50) NOT NULL DEFAULT 'update_settings',
  `changed_fields` TEXT NOT NULL,
  `previous_values` TEXT NOT NULL,
  `new_values` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_user_id`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Default DiscountSettings (id = 1)
INSERT INTO `DiscountSettings` (
  `id`,
  `new_user_discount_enabled`,
  `new_user_discount_percentage`,
  `new_user_discount_days`,
  `breakfast_early_discount_enabled`,
  `breakfast_early_discount_percentage`,
  `breakfast_early_discount_cutoff_time`,
  `lunch_early_discount_enabled`,
  `lunch_early_discount_percentage`,
  `lunch_early_discount_cutoff_time`,
  `snacks_early_discount_enabled`,
  `snacks_early_discount_percentage`,
  `snacks_early_discount_cutoff_time`,
  `dinner_early_discount_enabled`,
  `dinner_early_discount_percentage`,
  `dinner_early_discount_cutoff_time`
) VALUES (
  1, 1, 10.00, 5, 1, 10.00, '09:00', 1, 10.00, '12:00', 1, 10.00, '17:00', 1, 10.00, '20:30'
) ON DUPLICATE KEY UPDATE id=id;

-- -------------------------------------------------------------
-- Table: MealDiscountRule (Dynamic Per-Meal Early Discounts)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `MealDiscountRule`;
CREATE TABLE `MealDiscountRule` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meal_type` VARCHAR(50) NOT NULL UNIQUE,
  `display_name` VARCHAR(100) NOT NULL,
  `discount_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `cutoff_time` VARCHAR(10) NOT NULL DEFAULT '12:00',
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `MealDiscountRule` (`meal_type`, `display_name`, `discount_percentage`, `cutoff_time`, `is_enabled`)
VALUES 
  ('breakfast', 'Early Breakfast Discount', 10.00, '09:00', 1),
  ('lunch',     'Early Lunch Discount',     10.00, '12:00', 1),
  ('snacks',    'Early Snacks Discount',    10.00, '17:00', 1),
  ('dinner',    'Early Dinner Discount',    10.00, '20:30', 1)
ON DUPLICATE KEY UPDATE id=id;

-- Ensure dynamic meal types support in existing tables
ALTER TABLE `MenuItem` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL;
ALTER TABLE `MealWindow` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL;
ALTER TABLE `Order` MODIFY COLUMN `meal_type` VARCHAR(50) NOT NULL;

-- Ensure Order table backward-compatibility and required fulfillment columns
ALTER TABLE `Order` MODIFY COLUMN `student_id` INT NULL;
ALTER TABLE `Order` MODIFY COLUMN `expires_at` DATETIME NULL;
ALTER TABLE `Order` MODIFY COLUMN `token_number` VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE `Order` MODIFY COLUMN `formatted_token` VARCHAR(50) NULL DEFAULT '';
ALTER TABLE `Order` MODIFY COLUMN `payment_method` VARCHAR(50) NOT NULL DEFAULT 'cash';

SET FOREIGN_KEY_CHECKS = 1;
