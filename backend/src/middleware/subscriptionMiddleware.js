/**
 * Global Subscription & Client Status Enforcement Middleware
 * Enforces cascading suspension across both Admin and Student panels based on Client.status
 * and independent panel access toggles (is_admin_enabled, is_student_enabled).
 */

const { pool } = require('../database/db');
const { getOrCreateSubscriptionRecord } = require('../controllers/subscriptionController');

const checkSubscriptionStatus = async (req, res, next) => {
  const path = req.path || req.originalUrl || '';

  // Excluded route patterns that must remain accessible when subscription is expired/suspended:
  const isExcluded =
    path.startsWith('/api/super-admin') ||
    path.startsWith('/super-admin') ||
    path.startsWith('/api/subscription') ||
    path.startsWith('/subscription') ||
    path.startsWith('/api/webhook/razorpay-subscription') ||
    path.startsWith('/webhook/razorpay-subscription') ||
    path.startsWith('/api/auth/admin/login') ||
    path.startsWith('/auth/admin/login') ||
    path === '/api/health' ||
    path === '/';

  if (isExcluded) {
    return next();
  }

  try {
    // 1. Check Primary Client Organization Status in DB
    const [clientRows] = await pool.query('SELECT * FROM `Client` ORDER BY id ASC LIMIT 1');
    const client = clientRows[0] || null;

    if (client) {
      const now = new Date();

      // Check Master Suspension
      if (client.status === 'suspended') {
        return res.status(402).json({
          success: false,
          code: 'CLIENT_SUSPENDED',
          status: 'suspended',
          message: 'Currently the App is expired. Kindly contact to the Canteen(Mess).',
        });
      }

      // Check Expiry (Trial or Subscription)
      const isTrialExpired = client.status === 'trial' && client.trial_ends_at && new Date(client.trial_ends_at) < now;
      const isSubExpired = client.status === 'active' && client.subscription_ends_at && new Date(client.subscription_ends_at) < now;

      if (client.status === 'expired' || isTrialExpired || isSubExpired) {
        return res.status(402).json({
          success: false,
          code: 'SUBSCRIPTION_EXPIRED',
          status: 'expired',
          message: 'This canteen subscription or trial has expired. Please contact administration for renewal.',
        });
      }

      // 2. Check Independent Panel Access Toggles
      const isAdminRoute =
        path.startsWith('/api/auth/admin') ||
        path.startsWith('/auth/admin') ||
        path.startsWith('/api/admin') ||
        path.startsWith('/admin') ||
        path.startsWith('/api/inventory') ||
        path.startsWith('/inventory');

      const isStudentRoute =
        path.startsWith('/api/auth/student') ||
        path.startsWith('/auth/student') ||
        path.startsWith('/api/orders') ||
        path.startsWith('/orders') ||
        path.startsWith('/api/menu') ||
        path.startsWith('/menu');

      if (isAdminRoute && !client.is_admin_enabled) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_PANEL_DISABLED',
          message: 'Admin panel access is currently disabled for this organization.',
        });
      }

      if (isStudentRoute && !client.is_student_enabled) {
        return res.status(403).json({
          success: false,
          code: 'STUDENT_PANEL_DISABLED',
          message: 'Student meal booking portal is currently paused by administration.',
        });
      }
    } else {
      // Fallback to legacy Subscription check if no client row exists yet
      const subscription = await getOrCreateSubscriptionRecord();
      const now = new Date();
      const isExpired = subscription.status !== 'active' || subscription.subscription_end_date < now;

      if (isExpired) {
        return res.status(402).json({
          success: false,
          code: 'SUBSCRIPTION_EXPIRED',
          status: subscription.status,
          message: 'Currently the App is suspended. Kindly contact to the Canteen(Mess).',
        });
      }
    }

    next();
  } catch (error) {
    console.error('[Subscription Middleware Error]', error);
    next();
  }
};

module.exports = {
  checkSubscriptionStatus,
};
