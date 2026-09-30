const express = require('express');
const router = express.Router();
const {
  getDiscountSettings,
  updateDiscountSettings,
  createOrUpdateMealDiscountRule,
  deleteMealDiscountRule,
} = require('../controllers/discountController');
const { verifyAdmin, requireRole } = require('../middleware/authMiddleware');

// GET /api/admin/discount-settings
// Accessible to super_admin, admin, and staff
router.get('/', verifyAdmin, getDiscountSettings);

// PUT /api/admin/discount-settings
// Accessible to super_admin and admin
router.put('/', verifyAdmin, requireRole('super_admin', 'admin'), updateDiscountSettings);

// POST /api/admin/discount-settings/rules
// Dynamically add or update a per-meal discount rule (Accessible to super_admin and admin)
router.post('/rules', verifyAdmin, requireRole('super_admin', 'admin'), createOrUpdateMealDiscountRule);

// DELETE /api/admin/discount-settings/rules/:meal_type
// Dynamically delete a custom discount rule (Accessible to super_admin and admin)
router.delete('/rules/:meal_type', verifyAdmin, requireRole('super_admin', 'admin'), deleteMealDiscountRule);

module.exports = router;
