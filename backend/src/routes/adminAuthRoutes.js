const express = require('express');
const router = express.Router();
const {
  loginAdmin,
  registerAdmin,
  createStaffAccount,
  setStaffPassword,
  listAdminAccounts,
  toggleStaffStatus,
  deleteStaffAccount,
  getAdminProfile,
  changePassword,
} = require('../controllers/adminAuthController');
const { verifyAdmin, requireRole } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Public admin auth endpoints
router.post('/login', authLimiter, loginAdmin);
router.post('/register', authLimiter, registerAdmin);
router.post('/set-password', setStaffPassword);

// Authenticated admin & staff endpoints
router.get('/me', verifyAdmin, getAdminProfile);
router.post('/change-password', verifyAdmin, changePassword);
router.get('/change-password', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Admin change-password endpoint is online. Submit a POST request with oldPassword and newPassword to change your password.',
  });
});

// Super Admin management endpoints (Strict RBAC)
router.get('/staff', verifyAdmin, requireRole('super_admin'), listAdminAccounts);
router.post('/staff', verifyAdmin, requireRole('super_admin'), createStaffAccount);
router.patch('/staff/:id/toggle', verifyAdmin, requireRole('super_admin'), toggleStaffStatus);
router.delete('/staff/:id', verifyAdmin, requireRole('super_admin'), deleteStaffAccount);

module.exports = router;
