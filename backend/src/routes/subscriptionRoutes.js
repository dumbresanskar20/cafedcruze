const express = require('express');
const router = express.Router();
const {
  getSubscriptionStatusDetails,
  getActivePlans,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  handleDevRazorpayWebhook,
  devTestExpireSubscription,
} = require('../controllers/subscriptionController');
const { verifyAdmin, requireRole } = require('../middleware/authMiddleware');

// Public/Authenticated status check and dynamic plans list
router.get('/status', getSubscriptionStatusDetails);
router.get('/plans', getActivePlans);

// Developer Razorpay Webhook (standalone route handling)
router.post('/webhook', handleDevRazorpayWebhook);

// Admin & Super Admin Renewal Operations (Staff excluded)
router.post('/create-order', verifyAdmin, requireRole('super_admin', 'admin'), createSubscriptionOrder);
router.post('/verify-payment', verifyAdmin, requireRole('super_admin', 'admin'), verifySubscriptionPayment);
router.post('/expire-test', verifyAdmin, requireRole('super_admin', 'admin'), devTestExpireSubscription);

module.exports = router;
