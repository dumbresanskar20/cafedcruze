/**
 * DEVELOPER RAZORPAY ACCOUNT ONLY - Used for Canteen Subscription Billing
 * ─────────────────────────────────────────────────────────────────────────
 * This controller handles canteen recurring subscription payments (canteen super_admin -> DEVELOPER).
 * It uses DEV_RAZORPAY_KEY_ID, DEV_RAZORPAY_KEY_SECRET, and DEV_RAZORPAY_WEBHOOK_SECRET.
 * Dynamically queries and synchronizes with the MySQL `Plan` and `Client` tables managed by Super-Admin.
 * NEVER mix or reference student checkout keys (RAZORPAY_KEY_ID / SECRET) here.
 * NEVER touch Order or OrderItem database tables in this controller.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const { pool } = require('../database/db');
const { cleanEnvValue } = require('./orderController');

/**
 * Helper to fetch dynamic plans from MySQL Plan table
 */
const getActivePlansFromDB = async () => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM `Plan` WHERE is_active = 1 ORDER BY price ASC'
    );

    if (rows.length === 0) {
      return [];
    }

    return rows.map((p) => {
      let durationDays = 30;
      if (p.billing_cycle === 'quarterly') durationDays = 90;
      else if (p.billing_cycle === 'six_month') durationDays = 180;
      else if (p.billing_cycle === 'yearly') durationDays = 365;

      const priceNum = parseFloat(p.price);
      const perDayVal = (priceNum / durationDays).toFixed(2);

      let feats = [];
      try {
        feats = typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || []);
      } catch (e) {
        feats = [];
      }

      return {
        id: p.code,
        db_id: p.id,
        name: p.name,
        code: p.code,
        price: priceNum,
        amount_in_paise: Math.round(priceNum * 100),
        duration_days: durationDays,
        billing_cycle: p.billing_cycle,
        trial_days: p.trial_days || 14,
        perDay: `₹${perDayVal}/day`,
        features: feats,
      };
    });
  } catch (err) {
    console.error('⚠️ [Subscription Controller] Error querying plans:', err);
    return [];
  }
};

/**
 * Centralized extractor for Developer Razorpay credentials from process.env
 */
const getDevRazorpayCredentials = () => {
  const keyId = cleanEnvValue(process.env.DEV_RAZORPAY_KEY_ID);
  const keySecret = cleanEnvValue(process.env.DEV_RAZORPAY_KEY_SECRET);
  const webhookSecret = cleanEnvValue(process.env.DEV_RAZORPAY_WEBHOOK_SECRET);
  return { keyId, keySecret, webhookSecret };
};

/**
 * Lazy helper to initialize Developer Razorpay instance
 */
const getDevRazorpayInstance = () => {
  const { keyId, keySecret } = getDevRazorpayCredentials();

  if (!keyId || !keySecret) {
    console.warn('[Subscription Controller] Developer Razorpay credentials not fully set in .env');
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * Get or initialize single-tenant Subscription record.
 */
/**
 * Get or initialize single-tenant Subscription record.
 */
const getOrCreateSubscriptionRecord = async () => {
  try {
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
  } catch (tableErr) {
    console.warn('⚠️ [Subscription Controller] Table check notice:', tableErr.message);
  }

  let subscription = null;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM `Subscription` ORDER BY id ASC LIMIT 1'
    );
    subscription = rows[0] || null;
  } catch (queryErr) {
    console.warn('⚠️ [Subscription Controller] Error querying Subscription table:', queryErr.message);
  }

  if (!subscription) {
    const now = new Date();
    const defaultEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days active by default

    try {
      const [result] = await pool.execute(
        `INSERT INTO \`Subscription\` (plan_type, subscription_start_date, subscription_end_date, status, last_payment_amount, last_payment_date, dev_razorpay_payment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'monthly',
          now,
          defaultEndDate,
          'active',
          1000.0,
          now,
          'init_dev_seed',
        ]
      );

      const [newRows] = await pool.execute(
        'SELECT * FROM `Subscription` WHERE id = ? LIMIT 1',
        [result.insertId]
      );
      subscription = newRows[0];
    } catch (insertErr) {
      console.warn('⚠️ [Subscription Controller] Error inserting default subscription:', insertErr.message);
      subscription = {
        id: 1,
        plan_type: 'monthly',
        subscription_start_date: now,
        subscription_end_date: defaultEndDate,
        status: 'active',
        last_payment_amount: 1000.0,
        last_payment_date: now,
        dev_razorpay_payment_id: 'init_dev_seed',
      };
    }
  }

  // Reactive expiry check
  const now = new Date();
  if (subscription.subscription_end_date && new Date(subscription.subscription_end_date) < now && subscription.status === 'active') {
    try {
      await pool.execute(
        'UPDATE `Subscription` SET status = ? WHERE id = ?',
        ['expired', subscription.id]
      );
      subscription.status = 'expired';
    } catch (updateErr) {
      console.warn('⚠️ [Subscription Controller] Status update notice:', updateErr.message);
    }
  }

  return subscription;
};

/**
 * Compute fresh days remaining
 */
const calculateDaysRemaining = (endDate) => {
  if (!endDate) return 30;
  const diffMs = new Date(endDate) - new Date();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * GET /api/subscription/status
 * Public / Protected endpoint to query subscription status & live plans metadata
 */
const getSubscriptionStatusDetails = async (req, res) => {
  try {
    const subscription = await getOrCreateSubscriptionRecord();
    const daysRemaining = calculateDaysRemaining(subscription.subscription_end_date);
    const dynamicPlans = await getActivePlansFromDB();

    // Also safely fetch primary Client status from Client table
    let client = null;
    try {
      const [clientRows] = await pool.query('SELECT * FROM `Client` ORDER BY id ASC LIMIT 1');
      client = clientRows[0] || null;
    } catch (clientErr) {
      console.warn('⚠️ [Subscription Controller] Client table query notice:', clientErr.message);
    }

    let isSuspended = subscription.status === 'suspended' || (client && client.status === 'suspended');
    let isExpired = subscription.status !== 'active' || daysRemaining <= 0 || (client && client.status === 'expired');

    return res.status(200).json({
      success: true,
      subscription: {
        ...subscription,
        days_remaining: daysRemaining,
        is_expired: isExpired,
        is_suspended: isSuspended,
      },
      client: client
        ? {
            id: client.id,
            name: client.name,
            status: client.status,
            is_admin_enabled: client.is_admin_enabled,
            is_student_enabled: client.is_student_enabled,
          }
        : null,
      plans: dynamicPlans,
      dev_razorpay_key_id: getDevRazorpayCredentials().keyId || 'rzp_test_DevSubBillingKeyId',
    });
  } catch (error) {
    console.error('[Subscription Controller] Error fetching status:', error);
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return res.status(200).json({
      success: true,
      subscription: {
        id: 1,
        plan_type: 'monthly',
        subscription_start_date: now,
        subscription_end_date: defaultEnd,
        status: 'active',
        days_remaining: 30,
        is_expired: false,
        is_suspended: false,
      },
      client: null,
      plans: [],
      dev_razorpay_key_id: getDevRazorpayCredentials().keyId || 'rzp_test_DevSubBillingKeyId',
      fallback: true,
    });
  }
};

/**
 * GET /api/subscription/plans
 * Returns real-time active subscription plans configured by Super-Admin
 */
const getActivePlans = async (req, res) => {
  try {
    const plans = await getActivePlansFromDB();
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    console.error('[Subscription Controller] Error fetching plans:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve plans.' });
  }
};

/**
 * POST /api/subscription/create-order
 * Super Admin creates a Razorpay order using DEVELOPER keys with live dynamic plan pricing
 */
const createSubscriptionOrder = async (req, res) => {
  try {
    const { plan_type } = req.body;
    const plans = await getActivePlansFromDB();
    const plan = plans.find((p) => p.id === plan_type || p.code === plan_type || String(p.db_id) === String(plan_type));

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan_type '${plan_type}'. Please select a valid plan.`,
      });
    }

    const devRazorpay = getDevRazorpayInstance();
    let devRazorpayOrderId = null;

    if (devRazorpay) {
      const rzpOrder = await devRazorpay.orders.create({
        amount: plan.amount_in_paise,
        currency: 'INR',
        receipt: `sub_rcpt_${Date.now()}`,
        notes: {
          plan_type: plan.id,
          plan_name: plan.name,
          duration_days: plan.duration_days,
          type: 'canteen_subscription',
        },
      });
      devRazorpayOrderId = rzpOrder.id;
    } else {
      devRazorpayOrderId = `sub_order_mock_${Date.now()}`;
      console.log(`[Subscription Controller] DEV Razorpay live keys missing; using mock order ID: ${devRazorpayOrderId}`);
    }

    return res.status(200).json({
      success: true,
      dev_razorpay_order_id: devRazorpayOrderId,
      amount: plan.amount_in_paise,
      currency: 'INR',
      key_id: getDevRazorpayCredentials().keyId || 'rzp_test_DevSubBillingKeyId',
      plan: plan,
    });
  } catch (error) {
    console.error('[Subscription Controller] Error creating subscription order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create subscription order with Developer Razorpay account.',
      error: error.message,
    });
  }
};

/**
 * POST /api/subscription/verify-payment
 * Super Admin verifies payment and renews/extends subscription.
 * Uses DEV Razorpay credentials only.
 */
const verifySubscriptionPayment = async (req, res) => {
  try {
    const {
      dev_razorpay_order_id,
      dev_razorpay_payment_id,
      dev_razorpay_signature,
      plan_type,
    } = req.body;

    const plans = await getActivePlansFromDB();
    const plan = plans.find((p) => p.id === plan_type || p.code === plan_type || String(p.db_id) === String(plan_type));

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan_type '${plan_type}'.`,
      });
    }

    const devSecret = getDevRazorpayCredentials().keySecret;
    let isValidSignature = true;

    if (devSecret && dev_razorpay_signature && !dev_razorpay_order_id?.startsWith('sub_order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', devSecret)
        .update(`${dev_razorpay_order_id}|${dev_razorpay_payment_id}`)
        .digest('hex');

      try {
        const expectedBuf = Buffer.from(generatedSignature, 'utf8');
        const actualBuf = Buffer.from(dev_razorpay_signature, 'utf8');
        isValidSignature = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
      } catch (e) {
        isValidSignature = false;
      }
    }

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Developer Razorpay payment signature verification failed.',
      });
    }

    const currentSubscription = await getOrCreateSubscriptionRecord();
    const now = new Date();
    let newStartDate = currentSubscription.subscription_start_date;
    let baseEndDate = currentSubscription.subscription_end_date;

    // RENEWAL RULE:
    // If current subscription is active and end_date is in the future, extend forward from baseEndDate.
    // If current subscription is expired or end_date <= now, start from today (now).
    if (currentSubscription.status !== 'active' || !baseEndDate || baseEndDate < now) {
      newStartDate = now;
      baseEndDate = now;
    }

    const planMs = plan.duration_days * 24 * 60 * 60 * 1000;
    const newEndDate = new Date(baseEndDate.getTime() + planMs);

    // Update Subscription Table
    await pool.execute(
      `UPDATE Subscription SET plan_type = ?, subscription_start_date = ?, subscription_end_date = ?, status = ?, last_payment_amount = ?, last_payment_date = ?, dev_razorpay_payment_id = ?
       WHERE id = ?`,
      [
        plan.id,
        newStartDate,
        newEndDate,
        'active',
        plan.price,
        now,
        dev_razorpay_payment_id || `pay_dev_mock_${Date.now()}`,
        currentSubscription.id,
      ]
    );

    // Synchronize Client Table
    await pool.execute(
      `UPDATE \`Client\` 
       SET plan_id = ?, subscription_price = ?, subscription_started_at = ?, subscription_ends_at = ?, status = 'active'
       WHERE id = 1`,
      [plan.db_id || null, plan.price, newStartDate, newEndDate]
    );

    const [updatedRows] = await pool.execute(
      'SELECT * FROM Subscription WHERE id = ? LIMIT 1',
      [currentSubscription.id]
    );
    const updatedSub = updatedRows[0];
    const daysRemaining = calculateDaysRemaining(updatedSub.subscription_end_date);

    // Broadcast real-time status update to both Admin and Student apps via Socket.IO
    const io = req.app?.get('socketio');
    if (io) {
      io.emit('subscription:status_changed', {
        status: 'active',
        is_expired: false,
        subscription_end_date: newEndDate,
        plan_type: plan.id,
      });
      io.emit('client:status_changed', {
        status: 'active',
        subscription_ends_at: newEndDate,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Subscription successfully extended until ${newEndDate.toISOString().split('T')[0]}.`,
      subscription: {
        ...updatedSub,
        days_remaining: daysRemaining,
        is_expired: false,
      },
    });
  } catch (error) {
    console.error('[Subscription Controller] Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription payment with Developer Razorpay account.',
      error: error.message,
    });
  }
};

/**
 * Webhook handler for Developer Razorpay subscription events
 */
const handleDevRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = getDevRazorpayCredentials().webhookSecret;
    const signature = req.headers['x-razorpay-signature'];

    if (webhookSecret && signature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      try {
        const expectedBuf = Buffer.from(digest, 'utf8');
        const actualBuf = Buffer.from(signature, 'utf8');
        if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
          console.warn('[Dev Webhook] Signature mismatch, rejecting payload');
          return res.status(400).json({ status: 'invalid_signature' });
        }
      } catch (e) {
        return res.status(400).json({ status: 'invalid_signature' });
      }
    }

    const event = req.body.event;
    console.log(`[Dev Razorpay Webhook] Received developer event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      const notes = paymentEntity?.notes || {};

      if (notes.type === 'canteen_subscription' && notes.plan_type) {
        const plans = await getActivePlansFromDB();
        const plan = plans.find((p) => p.id === notes.plan_type);

        if (plan) {
          const currentSub = await getOrCreateSubscriptionRecord();
          const now = new Date();
          const baseEnd = currentSub.status === 'active' && currentSub.subscription_end_date > now ? currentSub.subscription_end_date : now;
          const planMs = plan.duration_days * 24 * 60 * 60 * 1000;
          const newEndDate = new Date(baseEnd.getTime() + planMs);

          await pool.execute(
            `UPDATE Subscription SET plan_type = ?, subscription_end_date = ?, status = 'active', last_payment_amount = ?, last_payment_date = ?, dev_razorpay_payment_id = ?
             WHERE id = ?`,
            [
              plan.id,
              newEndDate,
              plan.price,
              now,
              paymentEntity.id,
              currentSub.id,
            ]
          );

          await pool.execute(
            `UPDATE \`Client\` SET subscription_ends_at = ?, status = 'active', subscription_price = ? WHERE id = 1`,
            [newEndDate, plan.price]
          );

          const io = req.app?.get('socketio');
          if (io) {
            io.emit('subscription:status_changed', {
              status: 'active',
              is_expired: false,
              subscription_end_date: newEndDate,
            });
            io.emit('client:status_changed', {
              status: 'active',
              subscription_ends_at: newEndDate,
            });
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Dev Webhook Error]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * DEV ONLY: Test endpoint to instantly expire subscription for QA testing
 */
const devTestExpireSubscription = async (req, res) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await pool.execute(
      "UPDATE Subscription SET subscription_end_date = ?, status = 'expired' WHERE id = 1",
      [yesterday]
    );
    await pool.execute(
      "UPDATE `Client` SET subscription_ends_at = ?, status = 'expired' WHERE id = 1",
      [yesterday]
    );

    const io = req.app?.get('socketio');
    if (io) {
      io.emit('subscription:status_changed', {
        status: 'expired',
        is_expired: true,
      });
      io.emit('client:status_changed', {
        status: 'expired',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription has been forcefully expired for development testing.',
    });
  } catch (error) {
    console.error('[Dev Test Expire Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOrCreateSubscriptionRecord,
  getSubscriptionStatusDetails,
  getActivePlans,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  handleDevRazorpayWebhook,
  devTestExpireSubscription,
  getDevRazorpayCredentials,
};
