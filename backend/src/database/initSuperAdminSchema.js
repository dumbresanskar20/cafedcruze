const bcrypt = require('bcryptjs');
const { pool } = require('./db');

/**
 * Initializes Super-Admin multi-client database tables, plans, seeds, and client records.
 */
const initSuperAdminSchema = async () => {
  try {
    console.log('[SuperAdmin Schema] Checking and initializing Super-Admin tables...');

    // 1. SuperAdmin Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`SuperAdmin\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`last_login_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 1b. Core Subscription Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`Subscription\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`plan_type\` ENUM('monthly', 'quarterly', 'six_month', 'yearly') NOT NULL DEFAULT 'monthly',
        \`subscription_start_date\` DATETIME NOT NULL,
        \`subscription_end_date\` DATETIME NOT NULL,
        \`status\` ENUM('active', 'expired', 'suspended') NOT NULL DEFAULT 'active',
        \`last_payment_amount\` DECIMAL(10, 2) NULL,
        \`last_payment_date\` DATETIME NULL,
        \`dev_razorpay_payment_id\` VARCHAR(255) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Plan Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`Plan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`code\` VARCHAR(100) NOT NULL UNIQUE,
        \`billing_cycle\` ENUM('monthly', 'quarterly', 'six_month', 'yearly', 'custom') NOT NULL DEFAULT 'monthly',
        \`price\` DECIMAL(10, 2) NOT NULL,
        \`trial_days\` INT NOT NULL DEFAULT 14,
        \`features\` JSON NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. PlanPriceHistory Table (Audit trail for price changes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`PlanPriceHistory\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`plan_id\` INT NOT NULL,
        \`old_price\` DECIMAL(10, 2) NOT NULL,
        \`new_price\` DECIMAL(10, 2) NOT NULL,
        \`changed_by_id\` INT NULL,
        \`changed_by_name\` VARCHAR(255) NULL,
        \`reason\` VARCHAR(500) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`plan_id\`) REFERENCES \`Plan\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Client (Tenant) Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`Client\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`slug\` VARCHAR(100) NOT NULL UNIQUE,
        \`contact_email\` VARCHAR(255) NOT NULL,
        \`contact_phone\` VARCHAR(20) NULL,
        \`address\` VARCHAR(500) NULL,
        \`plan_id\` INT NULL,
        \`status\` ENUM('active', 'trial', 'suspended', 'expired') NOT NULL DEFAULT 'trial',
        \`trial_ends_at\` DATETIME NULL,
        \`subscription_price\` DECIMAL(10, 2) NULL,
        \`subscription_started_at\` DATETIME NULL,
        \`subscription_ends_at\` DATETIME NULL,
        \`suspended_at\` DATETIME NULL,
        \`is_admin_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`is_student_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`notes\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`plan_id\`) REFERENCES \`Plan\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. SuperAdminAuditLog Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`SuperAdminAuditLog\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`actor_id\` INT NULL,
        \`actor_name\` VARCHAR(255) NOT NULL,
        \`actor_email\` VARCHAR(255) NOT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`client_id\` INT NULL,
        \`client_name\` VARCHAR(255) NULL,
        \`before_value\` JSON NULL,
        \`after_value\` JSON NULL,
        \`ip_address\` VARCHAR(100) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Seed Default Plans if empty
    const [planRows] = await pool.query('SELECT COUNT(*) as count FROM `Plan`');
    if (planRows[0].count === 0) {
      console.log('[SuperAdmin Schema] Seeding standard subscription plans...');
      const defaultPlans = [
        {
          name: 'Monthly Standard',
          code: 'monthly',
          billing_cycle: 'monthly',
          price: 1000.0,
          trial_days: 14,
          features: JSON.stringify([
            'Unlimited Student Meal Bookings',
            'Live Kitchen Order Screen',
            'Menu & Timing Controls',
            'Basic Inventory Tracking',
            'Email Support',
          ]),
        },
        {
          name: 'Quarterly Pro',
          code: 'quarterly',
          billing_cycle: 'quarterly',
          price: 2700.0,
          trial_days: 14,
          features: JSON.stringify([
            'All Monthly Features',
            '10% Discount on Plan',
            'Full Inventory & Recipe Tracking',
            'Order History & Analytics',
            'Priority Support',
          ]),
        },
        {
          name: 'Half-Yearly Elite',
          code: 'six_month',
          billing_cycle: 'six_month',
          price: 5000.0,
          trial_days: 14,
          features: JSON.stringify([
            'All Quarterly Features',
            '16% Discount on Plan',
            'Automated Token Cleanup',
            'Multi-Staff Role Management',
            '24/7 Dedicated Support',
          ]),
        },
        {
          name: 'Annual Enterprise',
          code: 'yearly',
          billing_cycle: 'yearly',
          price: 9000.0,
          trial_days: 30,
          features: JSON.stringify([
            'All Half-Yearly Features',
            '25% Discount (3 Months Free)',
            'Custom Branding & Emblem',
            'Unlimited Staff Accounts',
            'Dedicated Account Manager',
          ]),
        },
      ];

      for (const p of defaultPlans) {
        await pool.execute(
          'INSERT INTO `Plan` (name, code, billing_cycle, price, trial_days, features, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [p.name, p.code, p.billing_cycle, p.price, p.trial_days, p.features]
        );
      }
    }

    // 7. Seed Master SuperAdmin if empty
    const [superRows] = await pool.query('SELECT COUNT(*) as count FROM `SuperAdmin`');
    if (superRows[0].count === 0) {
      console.log('[SuperAdmin Schema] Seeding master SuperAdmin user...');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('SuperAdmin@123', salt);

      await pool.execute(
        'INSERT INTO `SuperAdmin` (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)',
        ['Master Super Admin', 'superadmin@canteen.com', hash, 'super_admin']
      );
    }

    // 8. Seed / Synchronize Default Client (`Cafe D Cruze Restaurant`)
    const [clientRows] = await pool.query('SELECT COUNT(*) as count FROM `Client`');
    if (clientRows[0].count === 0) {
      console.log('[SuperAdmin Schema] Seeding primary client Cafe D Cruze Restaurant...');
      const [firstPlan] = await pool.query('SELECT id, price FROM `Plan` WHERE code = ? LIMIT 1', ['monthly']);
      const planId = firstPlan[0]?.id || null;
      const planPrice = firstPlan[0]?.price || 1000.0;

      const now = new Date();
      const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await pool.execute(
        `INSERT INTO \`Client\` 
          (name, slug, contact_email, contact_phone, address, plan_id, status, trial_ends_at, subscription_price, subscription_started_at, subscription_ends_at, is_admin_enabled, is_student_enabled, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [
          'Cafe D Cruze Restaurant',
          'cafe-d-cruze',
          'contact@cafedcruze.com',
          '+91 9876543210',
          'Cafe D Cruze Restaurant, Campus Food Court',
          planId,
          'active',
          trialEnds,
          planPrice,
          now,
          nextYear,
          'Primary restaurant client.',
        ]
      );
    } else {
      // Synchronize existing Client row name from DYPCOEI Canteen to Cafe D Cruze Restaurant
      await pool.execute(
        `UPDATE \`Client\` SET name = 'Cafe D Cruze Restaurant' WHERE name = 'DYPCOEI Canteen'`
      );
    }

    console.log('✅ [SuperAdmin Schema] Tables & seeds verified successfully.');
  } catch (error) {
    console.error('⚠️ [SuperAdmin Schema] Error initializing tables:', error);
  }
};

module.exports = { initSuperAdminSchema };
