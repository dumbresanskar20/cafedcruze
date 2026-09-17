const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyPaymentAndFulfill,
  razorpayWebhook,
  getStudentOrders,
  getKitchenOrders,
  getKitchenOrderCounts,
  updateOrderStatus,
  getAdminOrderHistory,
  getTodayIncome,
  getIncomeHistory,
  getAdminMonthlyOrderAnalytics,
  createManualOrder,
  getDiscountStatus,
  getRazorpayKey,
  syncOrderSchema,
  getMenuReport,
} = require('../controllers/orderController');
const { verifyStudent, optionalStudentAuth, verifyAdmin, requireRole } = require('../middleware/authMiddleware');

// Public / Client utility: Check server time and early order discount status (personalized if student token sent)
router.get('/discount-status', optionalStudentAuth, getDiscountStatus);

// Public / Client utility: Get active Canteen Razorpay Key ID
router.get('/razorpay-key', getRazorpayKey);

// Student endpoints (STRICT STUDENT JWT ENFORCED)
router.post('/create-razorpay-order', verifyStudent, createRazorpayOrder);
router.post('/verify-payment', verifyStudent, verifyPaymentAndFulfill);
router.get('/my-orders', verifyStudent, getStudentOrders);

// Razorpay Webhook Endpoint
router.post('/webhook', razorpayWebhook);

// Kitchen / Admin endpoints
router.get('/kitchen-orders', verifyAdmin, getKitchenOrders);
router.get('/kitchen-order-counts', verifyAdmin, getKitchenOrderCounts);
router.patch('/status/:id', verifyAdmin, updateOrderStatus);
router.post('/sync-schema', verifyAdmin, syncOrderSchema);
router.get('/sync-schema', verifyAdmin, syncOrderSchema);

// Admin Manual Walk-in Order Creation (Feature 1 - Admin & Staff JWT)
router.post('/manual', verifyAdmin, createManualOrder);
router.post('/admin/orders/manual', verifyAdmin, createManualOrder);

// Admin Order History & Monthly Analytics (Accessible to admin and super_admin)
router.get('/history', verifyAdmin, getAdminOrderHistory);
router.get('/admin/orders/history', verifyAdmin, getAdminOrderHistory);
router.get('/monthly-analytics', verifyAdmin, getAdminMonthlyOrderAnalytics);
router.get('/admin/orders/monthly-analytics', verifyAdmin, getAdminMonthlyOrderAnalytics);
router.get('/menu-report', verifyAdmin, getMenuReport);
router.get('/admin/orders/menu-report', verifyAdmin, getMenuReport);

// Admin Income Endpoints (Accessible to super_admin and admin roles)
router.get('/income/today', verifyAdmin, requireRole('super_admin', 'admin'), getTodayIncome);
router.get('/admin/income/today', verifyAdmin, requireRole('super_admin', 'admin'), getTodayIncome);
router.get('/income/history', verifyAdmin, requireRole('super_admin', 'admin'), getIncomeHistory);
router.get('/admin/income/history', verifyAdmin, requireRole('super_admin', 'admin'), getIncomeHistory);

module.exports = router;
