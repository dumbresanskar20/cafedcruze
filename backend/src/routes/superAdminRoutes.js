const express = require('express');
const router = express.Router();
const {
  login,
  getProfile,
  changePassword,
  getDashboardMetrics,
  getCanteenDetails,
  updateCanteenStatus,
  toggleCanteenPanelAccess,
  extendCanteenTrial,
  updateCanteenSubscription,
  addCanteenManualDays,
  deleteCanteenSubscription,
  updateCanteenNotes,
  listCanteenOrders,
  listCanteenStudents,
  listCanteenMenu,
  listCanteenInventory,
  listCanteenStaff,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  changePlanPrice,
  getPlanPriceHistory,
  listAuditLogs,
} = require('../controllers/superAdminController');
const { verifySuperAdmin } = require('../middleware/superAdminAuthMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Public Super-Admin Auth
router.post('/auth/login', authLimiter, login);

// Protected Super-Admin Endpoints
router.use(verifySuperAdmin);

// Profile
router.get('/auth/me', getProfile);
router.post('/auth/change-password', changePassword);

// Dashboard
router.get('/dashboard/metrics', getDashboardMetrics);

// DYPCOEI Canteen Controls & Subscription Management
router.get('/canteen', getCanteenDetails);
router.post('/canteen/status', updateCanteenStatus);
router.post('/canteen/toggle-access', toggleCanteenPanelAccess);
router.post('/canteen/extend-trial', extendCanteenTrial);
router.post('/canteen/update-subscription', updateCanteenSubscription);
router.post('/canteen/add-manual-days', addCanteenManualDays);
router.post('/canteen/delete-subscription', deleteCanteenSubscription);
router.post('/canteen/notes', updateCanteenNotes);

// Full Database Data Explorers (DYPCOEI Canteen)
router.get('/data/orders', listCanteenOrders);
router.get('/data/students', listCanteenStudents);
router.get('/data/menu', listCanteenMenu);
router.get('/data/inventory', listCanteenInventory);
router.get('/data/staff', listCanteenStaff);

// Plans & Pricing Controls
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);
router.post('/plans/:id/delete', deletePlan);
router.post('/plans/:id/change-price', changePlanPrice);
router.get('/plans/price-history', getPlanPriceHistory);
router.get('/plans/:id/price-history', getPlanPriceHistory);

// Audit Logs
router.get('/audit-logs', listAuditLogs);

module.exports = router;
